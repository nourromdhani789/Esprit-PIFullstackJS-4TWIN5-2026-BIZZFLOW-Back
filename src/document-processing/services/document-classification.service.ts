import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentType, ProcessingConfidence } from '../types/document-processing.types';

/**
 * Document Classification Service
 * 
 * Uses Google Cloud Vision API (free tier: 1000 requests/month)
 * or OpenRouter AI for document classification.
 * 
 * Fallback: Rule-based classification using keyword detection
 */

interface ClassificationResult {
  documentType: DocumentType;
  confidence: number;
  confidenceLevel: ProcessingConfidence;
  method: 'ai' | 'rule-based';
  rawResponse?: any;
}

// Keywords for rule-based classification (fallback)
const DOCUMENT_KEYWORDS: Record<DocumentType, string[]> = {
  [DocumentType.INVOICE]: [
    'invoice', 'facture', 'bill', 'due date', 'payment due', 'invoice number',
    'facture n°', 'montant total', 'total amount', 'subtotal', 'tax', 'tva',
    'payment terms', 'net due', 'amount due', 'balance due', 'facture#',
    'invoice#', 'inv #', 'fact #', 'please pay', 'payment required'
  ],
  [DocumentType.QUOTE]: [
    'quote', 'devis', 'quotation', 'estimate', 'pro forma', 'valid until',
    'quote number', 'devis n°', 'expiry date', 'valid for', 'proposal',
    'price quote', 'estimated cost', 'quote#', 'devis#', 'valid 30 days',
    'quote valid', 'devis valide'
  ],
  [DocumentType.SALES_ORDER]: [
    'sales order', 'order confirmation', 'purchase order', 'commande',
    'order number', 'order date', 'expected delivery', 'shipping date',
    'order status', 'confirmed order', 'po number', 'p.o.', 'commande n°',
    'bon de commande', 'delivery date', 'ship to', 'sold to'
  ],
  [DocumentType.UNKNOWN]: [],
};

@Injectable()
export class DocumentClassificationService {
  private readonly logger = new Logger(DocumentClassificationService.name);
  private readonly openRouterApiKey: string | undefined;
  private readonly useAI: boolean;

  constructor(private readonly configService: ConfigService) {
    this.openRouterApiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    this.useAI = !!this.openRouterApiKey;
    
    if (this.useAI) {
      this.logger.log('Using AI-based document classification (OpenRouter)');
    } else {
      this.logger.log('Using rule-based document classification (fallback)');
    }
  }

  /**
   * Classify a document based on its text content
   * @param text - Extracted text from the document
   * @returns Classification result with confidence score
   */
  async classifyDocument(text: string): Promise<ClassificationResult> {
    const startTime = Date.now();
    const lowerText = text.toLowerCase();
    const headerText = lowerText.substring(0, 500);
    
    // FIRST: Check for explicit document type headers (strongest signal)
    if (/\bsales\s*order\b/.test(headerText) || /\border\s*confirmation\b/.test(headerText) || 
        /\bpurchase\s*order\b/.test(headerText) || /\bbon\s*de\s*commande\b/.test(headerText)) {
      this.logger.debug('Explicit header detection: Sales Order');
      return {
        documentType: DocumentType.SALES_ORDER,
        confidence: 0.98,
        confidenceLevel: ProcessingConfidence.HIGH,
        method: 'rule-based',
      };
    }
    
    if (/\bquote\b/.test(headerText) || /\bdevis\b/.test(headerText) || 
        /\bquotation\b/.test(headerText) || /\bestimate\b/.test(headerText)) {
      this.logger.debug('Explicit header detection: Quote');
      return {
        documentType: DocumentType.QUOTE,
        confidence: 0.98,
        confidenceLevel: ProcessingConfidence.HIGH,
        method: 'rule-based',
      };
    }
    
    if (/\binvoice\b/.test(headerText) || /\bfacture\b/.test(headerText)) {
      this.logger.debug('Explicit header detection: Invoice');
      return {
        documentType: DocumentType.INVOICE,
        confidence: 0.98,
        confidenceLevel: ProcessingConfidence.HIGH,
        method: 'rule-based',
      };
    }
    
    try {
      // SECOND: Try AI classification if available (only if no explicit header found)
      if (this.useAI) {
        const aiResult = await this.classifyWithAI(text);
        if (aiResult.confidence >= 0.75) { // Higher threshold
          this.logger.debug(`AI classification took ${Date.now() - startTime}ms`);
          return aiResult;
        }
        // Fall through to rule-based if AI confidence is low
      }
      
      // THIRD: Use rule-based keyword scoring
      const ruleResult = this.classifyWithRules(text);
      this.logger.debug(`Rule-based classification took ${Date.now() - startTime}ms`);
      return ruleResult;
      
    } catch (error) {
      this.logger.error('Classification failed, using rule-based fallback', error);
      return this.classifyWithRules(text);
    }
  }

  /**
   * Classify using OpenRouter AI (free tier available)
   * Free models: google/gemma-3-27b-it, etc.
   */
  private async classifyWithAI(text: string): Promise<ClassificationResult> {
    const prompt = this.buildClassificationPrompt(text);
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openRouterApiKey}`,
          'HTTP-Referer': this.configService.get('APP_URL', 'http://localhost:3000'),
        },
        body: JSON.stringify({
          model: 'google/gemma-3-27b-it:free',
          messages: [
            {
              role: 'system',
              content: 'You are a document classification AI. Classify documents into: invoice, quote, sales_order, or unknown. Respond ONLY with JSON format: {"type": "invoice|quote|sales_order|unknown", "confidence": 0.0-1.0, "reasoning": "brief explanation"}'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 150,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('Empty response from AI');
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const result = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize the result
      const documentType = this.normalizeDocumentType(result.type);
      const confidence = Math.max(0, Math.min(1, parseFloat(result.confidence) || 0));

      return {
        documentType,
        confidence,
        confidenceLevel: this.getConfidenceLevel(confidence),
        method: 'ai',
        rawResponse: result,
      };

    } catch (error) {
      this.logger.error('AI classification error:', error);
      throw error;
    }
  }

  /**
   * Build classification prompt from document text
   */
  private buildClassificationPrompt(text: string): string {
    // Limit text length to avoid token limits
    const truncatedText = text.substring(0, 3000);
    
    return `Classify this business document:

Document text:
---
${truncatedText}
---

Determine if this is an: invoice, quote (or estimate/devis), sales_order (or purchase order), or unknown.

Consider:
- Invoices typically contain: invoice number, due date, amount due, payment terms
- Quotes/Estimates typically contain: quote number, valid until, expiry date, estimated cost
- Sales Orders typically contain: order number, order date, expected delivery, shipping info

Respond with JSON only.`;
  }

  /**
   * Classify using keyword-based rules (fallback method)
   */
  private classifyWithRules(text: string): ClassificationResult {
    const lowerText = text.toLowerCase();
    
    // Check first 500 characters for explicit document type header
    const headerText = lowerText.substring(0, 500);
    
    // Explicit header detection (strongest signal)
    if (/\bsales\s*order\b/.test(headerText) || /\border\s*confirmation\b/.test(headerText) || 
        /\bpurchase\s*order\b/.test(headerText) || /\bbon\s*de\s*commande\b/.test(headerText)) {
      return {
        documentType: DocumentType.SALES_ORDER,
        confidence: 0.95,
        confidenceLevel: ProcessingConfidence.HIGH,
        method: 'rule-based',
      };
    }
    
    if (/\bquote\b/.test(headerText) || /\bdevis\b/.test(headerText) || 
        /\bquotation\b/.test(headerText) || /\bestimate\b/.test(headerText)) {
      return {
        documentType: DocumentType.QUOTE,
        confidence: 0.95,
        confidenceLevel: ProcessingConfidence.HIGH,
        method: 'rule-based',
      };
    }
    
    if (/\binvoice\b/.test(headerText) || /\bfacture\b/.test(headerText)) {
      return {
        documentType: DocumentType.INVOICE,
        confidence: 0.95,
        confidenceLevel: ProcessingConfidence.HIGH,
        method: 'rule-based',
      };
    }
    
    // Continue with keyword scoring for the rest of the text
    const scores: Record<DocumentType, number> = {
      [DocumentType.INVOICE]: 0,
      [DocumentType.QUOTE]: 0,
      [DocumentType.SALES_ORDER]: 0,
      [DocumentType.UNKNOWN]: 0,
    };

    // Score each document type based on keyword matches
    for (const [docType, keywords] of Object.entries(DOCUMENT_KEYWORDS)) {
      if (docType === DocumentType.UNKNOWN) continue;
      
      let matchCount = 0;
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
        const matches = lowerText.match(regex);
        if (matches) {
          matchCount += matches.length;
        }
      }
      scores[docType as DocumentType] = matchCount;
    }

    // Find the type with highest score
    let bestType = DocumentType.UNKNOWN;
    let bestScore = 0;
    let totalScore = 0;

    for (const [type, score] of Object.entries(scores)) {
      totalScore += score;
      if (score > bestScore) {
        bestScore = score;
        bestType = type as DocumentType;
      }
    }

    // Calculate confidence based on score distribution
    let confidence: number;
    if (totalScore === 0) {
      confidence = 0.1;
    } else {
      // Confidence is ratio of best score to total scores
      const ratio = bestScore / totalScore;
      // Boost confidence if we have many matches
      const matchBoost = Math.min(bestScore / 5, 0.3);
      confidence = Math.min(ratio + matchBoost, 1.0);
    }

    return {
      documentType: bestType,
      confidence,
      confidenceLevel: this.getConfidenceLevel(confidence),
      method: 'rule-based',
    };
  }

  /**
   * Normalize document type string to enum
   * More strict matching to avoid false positives
   */
  private normalizeDocumentType(type: string): DocumentType {
    const normalized = type.toLowerCase().trim();
    
    // Check for invoice first (most specific)
    if (normalized === 'invoice' || normalized === 'facture' || 
        normalized.includes('invoice:') || normalized.includes('facture:') ||
        normalized.startsWith('invoice') || normalized.startsWith('facture')) {
      return DocumentType.INVOICE;
    }
    
    // Check for quote (second most specific)
    if (normalized === 'quote' || normalized === 'devis' || normalized === 'quotation' ||
        normalized.includes('quote:') || normalized.includes('devis:') ||
        normalized.includes('quotation:') || normalized.startsWith('quote') || 
        normalized.startsWith('devis') || normalized.startsWith('quotation')) {
      return DocumentType.QUOTE;
    }
    
    // Check for sales_order (must be specific phrases, not just 'order')
    if (normalized === 'sales_order' || normalized === 'purchase_order' ||
        normalized === 'sales order' || normalized === 'purchase order' ||
        normalized === 'order confirmation' || normalized === 'commande' ||
        normalized.includes('sales order:') || normalized.includes('purchase order:') ||
        normalized.startsWith('sales order') || normalized.startsWith('purchase order')) {
      return DocumentType.SALES_ORDER;
    }
    
    return DocumentType.UNKNOWN;
  }

  /**
   * Get confidence level from score
   */
  private getConfidenceLevel(confidence: number): ProcessingConfidence {
    if (confidence >= 0.85) return ProcessingConfidence.HIGH;
    if (confidence >= 0.60) return ProcessingConfidence.MEDIUM;
    return ProcessingConfidence.LOW;
  }
}
