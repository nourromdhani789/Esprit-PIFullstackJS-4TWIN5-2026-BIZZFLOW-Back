import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  DocumentType, 
  InvoiceExtractedData, 
  QuoteExtractedData, 
  SalesOrderExtractedData,
  ExtractedDocumentData 
} from '../types/document-processing.types';

/**
 * Structured Data Extraction Service
 * 
 * Extracts specific fields from OCR text based on document type.
 * Uses regex patterns and AI (OpenRouter) for intelligent extraction.
 * 
 * Each document type has its own extraction logic:
 * - Invoice: invoice number, dates, amounts, client info, items
 * - Quote: quote number, valid dates, amounts, client info, items
 * - Sales Order: order number, delivery dates, amounts, client info, items
 */

interface ExtractionResult {
  data: ExtractedDocumentData;
  confidence: number;
  method: 'regex' | 'ai' | 'hybrid';
  missingFields: string[];
}

@Injectable()
export class DataExtractionService {
  private readonly logger = new Logger(DataExtractionService.name);
  private readonly openRouterApiKey: string | undefined;
  private readonly useAI: boolean;

  constructor(private readonly configService: ConfigService) {
    this.openRouterApiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    this.useAI = !!this.openRouterApiKey;
  }

  /**
   * Extract structured data from OCR text based on document type
   */
  async extractData(text: string, documentType: DocumentType): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      // First pass: Regex-based extraction for all types
      const regexResult = this.extractWithRegex(text, documentType);
      
      // If we have many missing fields and AI is available, try AI enhancement
      const missingCount = regexResult.missingFields.length;
      
      if (this.useAI && missingCount > 3) {
        try {
          const aiResult = await this.extractWithAI(text, documentType);
          // Merge regex and AI results (prefer regex for exact matches, AI for missing fields)
          const mergedResult = this.mergeResults(regexResult, aiResult, documentType);
          this.logger.debug(`Hybrid extraction took ${Date.now() - startTime}ms`);
          return mergedResult;
        } catch (aiError) {
          this.logger.warn('AI extraction failed, using regex results:', aiError);
        }
      }
      
      this.logger.debug(`Regex extraction took ${Date.now() - startTime}ms`);
      return regexResult;
      
    } catch (error) {
      this.logger.error('Data extraction failed:', error);
      return {
        data: { documentType } as ExtractedDocumentData,
        confidence: 0.1,
        method: 'regex',
        missingFields: this.getExpectedFields(documentType),
      };
    }
  }

  /**
   * Extract data using regex patterns
   */
  private extractWithRegex(text: string, documentType: DocumentType): ExtractionResult {
    const normalizedText = this.normalizeText(text);
    
    switch (documentType) {
      case DocumentType.INVOICE:
        return this.extractInvoiceData(normalizedText);
      case DocumentType.QUOTE:
        return this.extractQuoteData(normalizedText);
      case DocumentType.SALES_ORDER:
        return this.extractSalesOrderData(normalizedText);
      default:
        return {
          data: { documentType: DocumentType.UNKNOWN },
          confidence: 0,
          method: 'regex',
          missingFields: [],
        };
    }
  }

  /**
   * Extract invoice-specific data
   */
  private extractInvoiceData(text: string): ExtractionResult {
    const data: InvoiceExtractedData = {
      documentType: DocumentType.INVOICE,
    };

    // Invoice Number patterns
    const invoiceNumberPatterns = [
      /(?:invoice|facture|inv)[\s#-]*(?:number|n°|no|num)?[\s#:]*([A-Z0-9-]+)/i,
      /(?:invoice|facture)[\s#:]*([A-Z0-9-]{3,})/i,
      /#?\s*([A-Z]{2,3}\d{4,})/i,
    ];
    data.invoiceNumber = this.extractWithPatterns(text, invoiceNumberPatterns);

    // Date patterns
    data.date = this.extractDate(text, /(?:invoice|issue|document)\s+(?:date|dated)?[:\s]+([\d/.-]+)/i);
    data.dueDate = this.extractDate(text, /(?:due|payment\s+due|date\s+d'échéance)[\s:]+([\d/.-]+)/i);

    // Client information
    const clientInfo = this.extractClientInfo(text);
    data.clientName = clientInfo.name;
    data.clientEmail = clientInfo.email;
    data.clientPhone = clientInfo.phone;
    data.clientAddress = clientInfo.address;

    // Amount patterns
    data.subtotal = this.extractAmount(text, /(?:subtotal|sous-total|net)[\s:]+[$€£]?\s*([\d,\.]+)/i);
    data.taxAmount = this.extractAmount(text, /(?:tax|tva|vat|gst)[\s:]+[$€£]?\s*([\d,\.]+)/i);
    data.totalAmount = this.extractTotalAmount(text);
    data.taxRate = this.extractTaxRate(text);

    // Notes
    data.notes = this.extractNotes(text);

    // Line items
    data.items = this.extractLineItems(text);

    // Calculate confidence and missing fields
    const expectedFields = ['invoiceNumber', 'date', 'totalAmount', 'clientName'];
    const missingFields = expectedFields.filter(f => !data[f as keyof InvoiceExtractedData]);
    
    const filledFields = expectedFields.length - missingFields.length;
    const confidence = filledFields / expectedFields.length;

    return {
      data,
      confidence,
      method: 'regex',
      missingFields,
    };
  }

  /**
   * Extract quote-specific data
   */
  private extractQuoteData(text: string): ExtractionResult {
    const data: QuoteExtractedData = {
      documentType: DocumentType.QUOTE,
    };

    // Quote Number patterns
    const quoteNumberPatterns = [
      /(?:quote|devis|quotation|estimate|est)[\s#-]*(?:number|n°|no|num)?[\s#:]*([A-Z0-9-]+)/i,
      /(?:quote|devis)[\s#:]*([A-Z0-9-]{3,})/i,
      /(?:quote|devis)\s*#?\s*([A-Z0-9-]{3,})/i,
    ];
    data.quoteNumber = this.extractWithPatterns(text, quoteNumberPatterns);

    // Date patterns
    data.issueDate = this.extractDate(text, /(?:quote|devis|issue)\s+(?:date|dated)?[:\s]+([\d/.-]+)/i);
    data.expiryDate = this.extractDate(text, /(?:valid\s+(?:until|till|through)|expires?|expiry|valable\s+jusqu'au)[\s:]+([\d/.-]+)/i);
    
    // Valid days if no expiry date
    if (!data.expiryDate) {
      const validDaysMatch = text.match(/(?:valid\s+for|valable\s+pendant)[\s:]+(\d+)\s*(?:days?|jours?)/i);
      if (validDaysMatch) {
        data.validDays = parseInt(validDaysMatch[1], 10);
      }
    }

    // Client information
    const clientInfo = this.extractClientInfo(text);
    data.clientName = clientInfo.name;
    data.clientEmail = clientInfo.email;
    data.clientPhone = clientInfo.phone;
    data.clientAddress = clientInfo.address;

    // Amount patterns
    data.subtotal = this.extractAmount(text, /(?:subtotal|sous-total|net)[\s:]+[$€£]?\s*([\d,\.]+)/i);
    data.taxAmount = this.extractAmount(text, /(?:tax|tva|vat)[\s:]+[$€£]?\s*([\d,\.]+)/i);
    data.totalAmount = this.extractTotalAmount(text);
    data.taxRate = this.extractTaxRate(text);

    // Notes
    data.notes = this.extractNotes(text);

    // Line items
    data.items = this.extractLineItems(text);

    // Calculate confidence and missing fields
    const expectedFields = ['quoteNumber', 'issueDate', 'totalAmount', 'clientName'];
    const missingFields = expectedFields.filter(f => !data[f as keyof QuoteExtractedData]);
    
    const filledFields = expectedFields.length - missingFields.length;
    const confidence = filledFields / expectedFields.length;

    return {
      data,
      confidence,
      method: 'regex',
      missingFields,
    };
  }

  /**
   * Extract sales order-specific data
   */
  private extractSalesOrderData(text: string): ExtractionResult {
    const data: SalesOrderExtractedData = {
      documentType: DocumentType.SALES_ORDER,
    };

    // Sales Order Number patterns
    const orderNumberPatterns = [
      /(?:sales\s+order|order|commande|ord)[\s#-]*(?:number|n°|no|num)?[\s#:]*([A-Z0-9-]+)/i,
      /(?:order|commande)[\s#:]*([A-Z0-9-]{3,})/i,
      /(?:SO|ORD)[-\s]*([\d-]+)/i,
    ];
    data.salesOrderNumber = this.extractWithPatterns(text, orderNumberPatterns);

    // Date patterns
    data.issueDate = this.extractDate(text, /(?:order|issue|commande)\s+(?:date|dated)?[:\s]+([\d/.-]+)/i);
    data.expectedDeliveryDate = this.extractDate(text, /(?:expected|estimated|delivery|expédié|livraison)[\s:]+([\d/.-]+)/i);

    // Client information
    const clientInfo = this.extractClientInfo(text);
    data.clientName = clientInfo.name;
    data.clientEmail = clientInfo.email;
    data.clientPhone = clientInfo.phone;
    data.clientAddress = clientInfo.address;

    // Amount patterns
    data.subtotal = this.extractAmount(text, /(?:subtotal|sous-total|net)[\s:]+[$€£]?\s*([\d,\.]+)/i);
    data.taxAmount = this.extractAmount(text, /(?:tax|tva|vat)[\s:]+[$€£]?\s*([\d,\.]+)/i);
    data.totalAmount = this.extractTotalAmount(text);
    data.taxRate = this.extractTaxRate(text);

    // Notes
    data.notes = this.extractNotes(text);

    // Line items
    data.items = this.extractLineItems(text);

    // Calculate confidence and missing fields
    const expectedFields = ['salesOrderNumber', 'issueDate', 'totalAmount', 'clientName'];
    const missingFields = expectedFields.filter(f => !data[f as keyof SalesOrderExtractedData]);
    
    const filledFields = expectedFields.length - missingFields.length;
    const confidence = filledFields / expectedFields.length;

    return {
      data,
      confidence,
      method: 'regex',
      missingFields,
    };
  }

  /**
   * Extract data using AI (OpenRouter)
   */
  private async extractWithAI(text: string, documentType: DocumentType): Promise<ExtractionResult> {
    const prompt = this.buildExtractionPrompt(text, documentType);
    
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
              content: `You are a data extraction AI. Extract structured data from business documents. Respond ONLY with valid JSON matching the expected schema for the document type. Use null for unknown values. Do not include explanations outside the JSON.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 800,
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

      const extracted = JSON.parse(jsonMatch[0]);
      
      // Map AI response to typed data structure
      const result = this.mapAIToTypedData(extracted, documentType);
      
      return {
        data: result,
        confidence: 0.75,
        method: 'ai',
        missingFields: this.getMissingFields(result, documentType),
      };

    } catch (error) {
      this.logger.error('AI extraction error:', error);
      throw error;
    }
  }

  /**
   * Build extraction prompt for AI
   */
  private buildExtractionPrompt(text: string, documentType: DocumentType): string {
    const truncatedText = text.substring(0, 4000);
    
    let schema: string;
    switch (documentType) {
      case DocumentType.INVOICE:
        schema = `{
  "documentType": "invoice",
  "invoiceNumber": "string or null",
  "date": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "clientName": "string or null",
  "clientEmail": "string or null",
  "clientPhone": "string or null",
  "clientAddress": "string or null",
  "subtotal": "number or null",
  "taxAmount": "number or null",
  "taxRate": "number or null",
  "totalAmount": "number or null",
  "notes": "string or null"
}`;
        break;
      case DocumentType.QUOTE:
        schema = `{
  "documentType": "quote",
  "quoteNumber": "string or null",
  "issueDate": "YYYY-MM-DD or null",
  "expiryDate": "YYYY-MM-DD or null",
  "validDays": "number or null",
  "clientName": "string or null",
  "clientEmail": "string or null",
  "clientPhone": "string or null",
  "clientAddress": "string or null",
  "subtotal": "number or null",
  "taxAmount": "number or null",
  "taxRate": "number or null",
  "totalAmount": "number or null",
  "notes": "string or null"
}`;
        break;
      case DocumentType.SALES_ORDER:
        schema = `{
  "documentType": "sales_order",
  "salesOrderNumber": "string or null",
  "issueDate": "YYYY-MM-DD or null",
  "expectedDeliveryDate": "YYYY-MM-DD or null",
  "clientName": "string or null",
  "clientEmail": "string or null",
  "clientPhone": "string or null",
  "clientAddress": "string or null",
  "subtotal": "number or null",
  "taxAmount": "number or null",
  "taxRate": "number or null",
  "totalAmount": "number or null",
  "notes": "string or null"
}`;
        break;
      default:
        schema = `{}`;
    }

    return `Extract structured data from this ${documentType} document.

Document text:
---
${truncatedText}
---

Extract the following fields and respond with JSON only:
${schema}

Rules:
- Parse dates as YYYY-MM-DD format
- Parse amounts as numbers (remove currency symbols)
- If a field is not found, use null
- Be precise with numbers and dates`;
  }

  /**
   * Map AI response to typed data structure
   */
  private mapAIToTypedData(aiData: any, documentType: DocumentType): ExtractedDocumentData {
    switch (documentType) {
      case DocumentType.INVOICE:
        return {
          documentType: DocumentType.INVOICE,
          invoiceNumber: aiData.invoiceNumber || null,
          date: aiData.date || null,
          dueDate: aiData.dueDate || null,
          clientName: aiData.clientName || null,
          clientEmail: aiData.clientEmail || null,
          clientPhone: aiData.clientPhone || null,
          clientAddress: aiData.clientAddress || null,
          subtotal: typeof aiData.subtotal === 'number' ? aiData.subtotal : null,
          taxAmount: typeof aiData.taxAmount === 'number' ? aiData.taxAmount : null,
          taxRate: typeof aiData.taxRate === 'number' ? aiData.taxRate : null,
          totalAmount: typeof aiData.totalAmount === 'number' ? aiData.totalAmount : null,
          notes: aiData.notes || null,
          items: aiData.items || [],
        };
      case DocumentType.QUOTE:
        return {
          documentType: DocumentType.QUOTE,
          quoteNumber: aiData.quoteNumber || null,
          issueDate: aiData.issueDate || null,
          expiryDate: aiData.expiryDate || null,
          validDays: typeof aiData.validDays === 'number' ? aiData.validDays : null,
          clientName: aiData.clientName || null,
          clientEmail: aiData.clientEmail || null,
          clientPhone: aiData.clientPhone || null,
          clientAddress: aiData.clientAddress || null,
          subtotal: typeof aiData.subtotal === 'number' ? aiData.subtotal : null,
          taxAmount: typeof aiData.taxAmount === 'number' ? aiData.taxAmount : null,
          taxRate: typeof aiData.taxRate === 'number' ? aiData.taxRate : null,
          totalAmount: typeof aiData.totalAmount === 'number' ? aiData.totalAmount : null,
          notes: aiData.notes || null,
          items: aiData.items || [],
        };
      case DocumentType.SALES_ORDER:
        return {
          documentType: DocumentType.SALES_ORDER,
          salesOrderNumber: aiData.salesOrderNumber || null,
          issueDate: aiData.issueDate || null,
          expectedDeliveryDate: aiData.expectedDeliveryDate || null,
          clientName: aiData.clientName || null,
          clientEmail: aiData.clientEmail || null,
          clientPhone: aiData.clientPhone || null,
          clientAddress: aiData.clientAddress || null,
          subtotal: typeof aiData.subtotal === 'number' ? aiData.subtotal : null,
          taxAmount: typeof aiData.taxAmount === 'number' ? aiData.taxAmount : null,
          taxRate: typeof aiData.taxRate === 'number' ? aiData.taxRate : null,
          totalAmount: typeof aiData.totalAmount === 'number' ? aiData.totalAmount : null,
          notes: aiData.notes || null,
          items: aiData.items || [],
        };
      default:
        return { documentType: DocumentType.UNKNOWN };
    }
  }

  /**
   * Merge regex and AI extraction results
   */
  private mergeResults(
    regexResult: ExtractionResult, 
    aiResult: ExtractionResult,
    documentType: DocumentType
  ): ExtractionResult {
    // Prefer regex for specific patterns, AI for missing fields
    const merged: any = { ...aiResult.data };
    const regexData: any = regexResult.data;
    
    // Override AI with regex for certain high-confidence fields
    if (regexData.invoiceNumber) merged.invoiceNumber = regexData.invoiceNumber;
    if (regexData.quoteNumber) merged.quoteNumber = regexData.quoteNumber;
    if (regexData.salesOrderNumber) merged.salesOrderNumber = regexData.salesOrderNumber;
    if (regexData.totalAmount) merged.totalAmount = regexData.totalAmount;
    
    // Recalculate missing fields
    const missingFields = this.getMissingFields(merged as ExtractedDocumentData, documentType);
    
    return {
      data: merged as ExtractedDocumentData,
      confidence: Math.max(regexResult.confidence, aiResult.confidence),
      method: 'hybrid',
      missingFields,
    };
  }

  // ============ HELPER METHODS ============

  /**
   * Normalize text for better extraction
   */
  private normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\u00A0/g, ' '); // Non-breaking space
  }

  /**
   * Try multiple patterns and return first match
   */
  private extractWithPatterns(text: string, patterns: RegExp[]): string | undefined {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  /**
   * Extract date from text using pattern
   */
  private extractDate(text: string, pattern: RegExp): string | undefined {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Try to normalize to YYYY-MM-DD
      const parsed = this.parseDate(match[1].trim());
      return parsed || match[1].trim();
    }
    return undefined;
  }

  /**
   * Parse various date formats to YYYY-MM-DD
   */
  private parseDate(dateStr: string): string | undefined {
    // Common formats: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
    const formats = [
      /(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/, // MM/DD/YYYY or DD/MM/YYYY
      /(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/, // YYYY-MM-DD
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        let year, month, day;
        
        if (match[1].length === 4) {
          // YYYY-MM-DD format
          year = match[1];
          month = match[2].padStart(2, '0');
          day = match[3].padStart(2, '0');
        } else {
          // Assume MM/DD/YYYY for US, DD/MM/YYYY for EU
          // Default to reasonable interpretation
          const first = parseInt(match[1], 10);
          const second = parseInt(match[2], 10);
          
          if (first > 12) {
            // Must be DD/MM
            day = match[1].padStart(2, '0');
            month = match[2].padStart(2, '0');
          } else {
            // Assume MM/DD (US format)
            month = match[1].padStart(2, '0');
            day = match[2].padStart(2, '0');
          }
          
          year = match[3].length === 2 ? `20${match[3]}` : match[3];
        }
        
        return `${year}-${month}-${day}`;
      }
    }
    
    return undefined;
  }

  /**
   * Extract client information from text
   */
  private extractClientInfo(text: string): {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  } {
    const result: any = {};

    // Email pattern
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      result.email = emailMatch[0];
    }

    // Phone pattern (various formats)
    const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) {
      result.phone = phoneMatch[0];
    }

    // Try to find client name - usually near "Bill To", "Client", "Customer"
    const billToPattern = /(?:bill\s+to|client|customer|sold\s+to|destinataire)[\s:]*\n?\s*([^\n]+(?:\n[^\n]+){0,3})/i;
    const billToMatch = text.match(billToPattern);
    if (billToMatch) {
      const lines = billToMatch[1].split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length > 0) {
        // First non-empty line is likely the company name
        result.name = lines[0];
        // Rest could be address
        if (lines.length > 1) {
          result.address = lines.slice(1).join(', ');
        }
      }
    }

    return result;
  }

  /**
   * Extract amount using pattern
   */
  private extractAmount(text: string, pattern: RegExp): number | undefined {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Remove currency symbols and normalize decimal separator
      const cleaned = match[1]
        .replace(/[$€£,]/g, '')
        .replace(/\s/g, '');
      const value = parseFloat(cleaned);
      return isNaN(value) ? undefined : value;
    }
    return undefined;
  }

  /**
   * Extract total amount from text
   */
  private extractTotalAmount(text: string): number | undefined {
    const patterns = [
      /(?:total|amount\s+due|total\s+due|montant\s+total|grand\s+total|balance\s+due)[\s:]+[$€£]?\s*([\d,\.]+)/i,
      /(?:total|total\s+amount)[:\s]+[$€£]?\s*([\d,\.]+)/i,
      /total\s*[$€£]?\s*([\d,\.\s]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const cleaned = match[1]
          .replace(/[$€£,\s]/g, '')
          .trim();
        const value = parseFloat(cleaned);
        if (!isNaN(value) && value > 0) {
          return value;
        }
      }
    }
    return undefined;
  }

  /**
   * Extract tax rate from text
   */
  private extractTaxRate(text: string): number | undefined {
    const patterns = [
      /(\d+(?:\.\d+)?)\s*%\s*(?:tax|vat|tva)/i,
      /(?:tax|vat|tva)\s*(?:rate)?[:\s]*(\d+(?:\.\d+)?)\s*%?/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const value = parseFloat(match[1]);
        if (!isNaN(value)) {
          return value > 1 ? value / 100 : value; // Normalize to decimal
        }
      }
    }
    return undefined;
  }

  /**
   * Extract notes or terms from text
   */
  private extractNotes(text: string): string | undefined {
    const patterns = [
      /(?:terms|conditions|notes|terms\s+&\s+conditions|commentaires)[\s:]*\n?([^\n]+(?:\n[^\n]+){0,5})/i,
      /(?:payment\s+terms|terms\s+of\s+payment)[\s:]*\n?([^\n]+(?:\n[^\n]+){0,3})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  /**
   * Extract line items from text
   */
  private extractLineItems(text: string): Array<{description: string; quantity: number; unitPrice: number; total: number}> | undefined {
    const items: Array<{description: string; quantity: number; unitPrice: number; total: number}> = [];
    
    // Look for table-like structures or itemized lists
    // This is a simplified approach - real implementation might need more sophisticated parsing
    const lines = text.split('\n');
    
    for (const line of lines) {
      // Pattern: description qty price total
      // Examples: "Product A 2 $10.00 $20.00" or "Service 1.5h $50/h $75.00"
      const itemPattern = /([^\d\n]{3,})\s+(\d+(?:\.\d+)?)\s*(?:hours?|h|pcs|units?)?\s*[$€£]?\s*([\d,\.]+)\s*(?:[$€£/\w]*)\s*[$€£]?\s*([\d,\.]+)/i;
      
      const match = line.match(itemPattern);
      if (match) {
        const description = match[1].trim();
        const quantity = parseFloat(match[2]);
        const unitPrice = parseFloat(match[3].replace(/,/g, ''));
        const total = parseFloat(match[4].replace(/,/g, ''));
        
        if (description && !isNaN(quantity) && !isNaN(unitPrice)) {
          items.push({
            description,
            quantity,
            unitPrice,
            total: !isNaN(total) ? total : quantity * unitPrice,
          });
        }
      }
    }

    return items.length > 0 ? items : undefined;
  }

  /**
   * Get expected fields for a document type
   */
  private getExpectedFields(documentType: DocumentType): string[] {
    switch (documentType) {
      case DocumentType.INVOICE:
        return ['invoiceNumber', 'date', 'totalAmount', 'clientName'];
      case DocumentType.QUOTE:
        return ['quoteNumber', 'issueDate', 'totalAmount', 'clientName'];
      case DocumentType.SALES_ORDER:
        return ['salesOrderNumber', 'issueDate', 'totalAmount', 'clientName'];
      default:
        return [];
    }
  }

  /**
   * Get missing fields from extracted data
   */
  private getMissingFields(data: ExtractedDocumentData, documentType: DocumentType): string[] {
    const expected = this.getExpectedFields(documentType);
    const dataAny = data as any;
    return expected.filter(field => !dataAny[field] && dataAny[field] !== 0);
  }
}
