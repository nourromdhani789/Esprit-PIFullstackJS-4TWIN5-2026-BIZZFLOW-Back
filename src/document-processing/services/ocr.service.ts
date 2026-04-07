import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';

/**
 * OCR Text Extraction Service
 * 
 * Uses Google Cloud Vision API (free tier: 1000 requests/month)
 * via service account credentials or API key
 * Falls back to OCR.space API (free tier: 25,000 requests/month)
 */

interface OCRResult {
  text: string;
  confidence: number;
  language?: string;
  method: 'google-vision' | 'ocr-space' | 'tesseract';
  processingTime: number;
}

interface GoogleCredentials {
  type: string;
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri: string;
}

@Injectable()
export class OCRService {
  private readonly logger = new Logger(OCRService.name);
  private readonly googleCredentialsPath: string | undefined;
  private readonly googleVisionKey: string | undefined;
  private readonly ocrSpaceKey: string | undefined;
  private readonly preferredMethod: 'google-vision' | 'ocr-space' | 'auto';
  private googleAccessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(private readonly configService: ConfigService) {
    this.googleCredentialsPath = this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS');
    this.googleVisionKey = this.configService.get<string>('GOOGLE_VISION_API_KEY');
    this.ocrSpaceKey = this.configService.get<string>('OCR_SPACE_API_KEY');
    
    // Determine preferred method
    if (this.googleCredentialsPath || this.googleVisionKey) {
      this.preferredMethod = 'google-vision';
      this.logger.log('Using Google Cloud Vision API for OCR');
    } else if (this.ocrSpaceKey) {
      this.preferredMethod = 'ocr-space';
      this.logger.log('Using OCR.space API for OCR');
    } else {
      this.preferredMethod = 'auto';
      this.logger.log('No OCR API keys configured. Will try free alternatives.');
    }
  }

  /**
   * Extract text from an image or PDF file
   * @param filePath - Path to the file
   * @param mimeType - MIME type of the file
   * @returns Extracted text with confidence score
   */
  async extractText(filePath: string, mimeType: string): Promise<OCRResult> {
    const startTime = Date.now();
    
    try {
      // Read file as base64
      const fileBuffer = await fs.readFile(filePath);
      const base64Data = fileBuffer.toString('base64');

      let result: OCRResult;

      // Try methods in order of preference
      if (this.preferredMethod === 'google-vision' || (this.preferredMethod === 'auto' && (this.googleVisionKey || this.googleCredentialsPath))) {
        try {
          result = await this.extractWithGoogleVision(base64Data, mimeType);
        } catch (error) {
          const errorMsg = (error as Error).message;
          // If billing error, try OCR.space as fallback
          if (errorMsg.includes('billing') || errorMsg.includes('403') || errorMsg.includes('PERMISSION_DENIED')) {
            this.logger.warn('Google Vision billing required, trying OCR.space fallback...');
            if (this.ocrSpaceKey) {
              result = await this.extractWithOCRSpace(fileBuffer, mimeType);
            } else {
              throw new Error('Google Vision requires billing. Please add OCR_SPACE_API_KEY to .env for free OCR (25,000 requests/month). Get key at https://ocr.space/ocrapi');
            }
          } else {
            throw error;
          }
        }
      } else if (this.preferredMethod === 'ocr-space' || (this.preferredMethod === 'auto' && this.ocrSpaceKey)) {
        result = await this.extractWithOCRSpace(fileBuffer, mimeType);
      } else {
        throw new Error('No OCR service configured. Please add OCR_SPACE_API_KEY to .env. Get free key at https://ocr.space/ocrapi (25,000 requests/month)');
      }

      result.processingTime = Date.now() - startTime;
      
      // Clean and normalize the extracted text
      result.text = this.cleanExtractedText(result.text);
      
      this.logger.debug(`OCR completed in ${result.processingTime}ms with confidence ${result.confidence}`);
      
      return result;

    } catch (error) {
      this.logger.error('OCR extraction failed:', error);
      throw new Error(`Failed to extract text: ${(error as Error).message}`);
    }
  }

  /**
   * Get OAuth2 access token from service account credentials
   */
  private async getGoogleAccessToken(): Promise<string> {
    // Return cached token if not expired
    if (this.googleAccessToken && Date.now() < this.tokenExpiry) {
      return this.googleAccessToken;
    }

    if (!this.googleCredentialsPath) {
      throw new Error('No Google credentials path configured');
    }

    try {
      // Read service account credentials
      const credsData = await fs.readFile(this.googleCredentialsPath, 'utf8');
      const credentials: GoogleCredentials = JSON.parse(credsData);

      // Create JWT assertion
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + 3600; // 1 hour

      const jwtHeader = { alg: 'RS256', typ: 'JWT' };
      const jwtClaimSet = {
        iss: credentials.client_email,
        sub: credentials.client_email,
        scope: 'https://www.googleapis.com/auth/cloud-vision',
        aud: credentials.token_uri,
        iat: now,
        exp: expiry,
      };

      const jwtHeaderB64 = Buffer.from(JSON.stringify(jwtHeader)).toString('base64url');
      const jwtClaimB64 = Buffer.from(JSON.stringify(jwtClaimSet)).toString('base64url');
      const jwtUnsigned = `${jwtHeaderB64}.${jwtClaimB64}`;

      // Sign with private key
      const crypto = await import('crypto');
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(jwtUnsigned);
      const signature = sign.sign(credentials.private_key, 'base64url');

      const jwt = `${jwtUnsigned}.${signature}`;

      // Exchange JWT for access token
      const tokenResponse = await fetch(credentials.token_uri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const tokenData = await tokenResponse.json() as { access_token: string; expires_in: number };
      this.googleAccessToken = tokenData.access_token;
      this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 60000; // Buffer 1 min

      return this.googleAccessToken;
    } catch (error) {
      this.logger.error('Failed to get Google access token:', error);
      throw new Error(`Authentication failed: ${(error as Error).message}`);
    }
  }

  /**
   * Extract text using Google Cloud Vision API
   * Free tier: 1000 requests/month
   * Supports both API key and service account authentication
   */
  private async extractWithGoogleVision(base64Data: string, mimeType: string): Promise<OCRResult> {
    let url: string;
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Use service account if credentials file is configured
    if (this.googleCredentialsPath) {
      const accessToken = await this.getGoogleAccessToken();
      url = 'https://vision.googleapis.com/v1/images:annotate';
      headers['Authorization'] = `Bearer ${accessToken}`;
    } else if (this.googleVisionKey) {
      // Fall back to API key authentication
      url = `https://vision.googleapis.com/v1/images:annotate?key=${this.googleVisionKey}`;
    } else {
      throw new Error('No Google Vision authentication configured');
    }
    
    const requestBody = {
      requests: [{
        image: {
          content: base64Data,
        },
        features: [{
          type: 'DOCUMENT_TEXT_DETECTION',
          maxResults: 1,
        }],
        imageContext: {
          languageHints: ['en', 'fr', 'es', 'de', 'it'],
        },
      }],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Vision API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const textAnnotation = data.responses?.[0]?.fullTextAnnotation;
    
    if (!textAnnotation) {
      // No text found in image
      return {
        text: '',
        confidence: 0,
        language: undefined,
        method: 'google-vision',
        processingTime: 0,
      };
    }

    // Calculate average confidence from pages
    let totalConfidence = 0;
    let pageCount = 0;
    
    if (textAnnotation.pages) {
      for (const page of textAnnotation.pages) {
        if (page.confidence !== undefined) {
          totalConfidence += page.confidence;
          pageCount++;
        }
      }
    }

    const confidence = pageCount > 0 ? totalConfidence / pageCount : 0.8;

    return {
      text: textAnnotation.text || '',
      confidence: confidence,
      language: textAnnotation.pages?.[0]?.property?.detectedLanguages?.[0]?.languageCode,
      method: 'google-vision',
      processingTime: 0,
    };
  }

  /**
   * Extract text using OCR.space API
   * Free tier: 25,000 requests/month, rate limited
   */
  private async extractWithOCRSpace(fileBuffer: Buffer, mimeType: string): Promise<OCRResult> {
    // Convert Buffer to Uint8Array for Blob compatibility
    const uint8Array = new Uint8Array(fileBuffer);
    const blob = new Blob([uint8Array], { type: mimeType });
    
    const formData = new FormData();
    formData.append('file', blob, 'document.jpg');
    formData.append('apikey', this.ocrSpaceKey!);
    formData.append('language', 'eng'); // Can be: eng, fre, spa, deu, ita, etc.
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2'); // Engine 2 is better for documents

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OCR.space API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    if (data.OCRExitCode !== 1) {
      throw new Error(`OCR.space error: ${data.ErrorMessage || 'Unknown error'}`);
    }

    // Combine text from all parsed results
    let fullText = '';
    let avgConfidence = 0;
    
    if (data.ParsedResults && data.ParsedResults.length > 0) {
      const texts: string[] = [];
      let totalConfidence = 0;
      
      for (const result of data.ParsedResults) {
        if (result.ParsedText) {
          texts.push(result.ParsedText);
        }
        if (result.TextOverlay && result.TextOverlay.HasOverlay) {
          totalConfidence += result.TextOverlay.Lines.reduce(
            (sum: number, line: any) => sum + (line.MaxHeight || 0), 
            0
          ) / result.TextOverlay.Lines.length;
        }
      }
      
      fullText = texts.join('\n');
      avgConfidence = totalConfidence / data.ParsedResults.length;
    }

    return {
      text: fullText,
      confidence: avgConfidence > 0 ? Math.min(avgConfidence / 100, 1) : 0.75,
      language: data.ParsedResults?.[0]?.Language || 'eng',
      method: 'ocr-space',
      processingTime: 0,
    };
  }

  /**
   * Clean and normalize extracted text
   * Removes noise, fixes common OCR errors, normalizes spacing
   */
  private cleanExtractedText(text: string): string {
    if (!text) return '';

    return text
      // Remove null bytes and control characters
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive whitespace
      .replace(/[ \t]+/g, ' ')
      // Remove excessive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Fix common OCR errors
      .replace(/([a-zA-Z])\s+(\d)/g, '$1 $2') // Ensure space between letters and numbers
      .replace(/(\d)\s+([a-zA-Z])/g, '$1 $2') // Ensure space between numbers and letters
      // Trim
      .trim();
  }

  /**
   * Preprocess image to improve OCR accuracy
   * Note: This is a placeholder for future image preprocessing
   * Could include: deskew, denoise, contrast enhancement, binarization
   */
  async preprocessImage(filePath: string): Promise<string> {
    // For now, return the same file path
    // In production, this could use Sharp or Jimp for image processing
    return filePath;
  }
}
