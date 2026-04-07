/**
 * AI Document Processing Pipeline
 * 
 * This module provides:
 * - Document upload with validation
 * - Document classification (invoice, quote, sales_order)
 * - OCR text extraction
 * - Structured data extraction with document-type specific fields
 * - Secure multi-tenant storage
 */

export enum DocumentProcessingStatus {
  PENDING = 'pending',
  CLASSIFYING = 'classifying',
  EXTRACTING_TEXT = 'extracting_text',
  EXTRACTING_DATA = 'extracting_data',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum DocumentType {
  INVOICE = 'invoice',
  QUOTE = 'quote',
  SALES_ORDER = 'sales_order',
  UNKNOWN = 'unknown',
}

export enum ProcessingConfidence {
  HIGH = 'high',    // > 85%
  MEDIUM = 'medium', // 60-85%
  LOW = 'low',       // < 60%
}

// Document fields for each document type
export interface InvoiceExtractedData {
  documentType: DocumentType.INVOICE;
  invoiceNumber?: string;
  date?: string;
  dueDate?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  subtotal?: number;
  taxAmount?: number;
  taxRate?: number;
  totalAmount?: number;
  notes?: string;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

export interface QuoteExtractedData {
  documentType: DocumentType.QUOTE;
  quoteNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  subtotal?: number;
  taxAmount?: number;
  taxRate?: number;
  totalAmount?: number;
  notes?: string;
  validDays?: number;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

export interface SalesOrderExtractedData {
  documentType: DocumentType.SALES_ORDER;
  salesOrderNumber?: string;
  issueDate?: string;
  expectedDeliveryDate?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  subtotal?: number;
  taxAmount?: number;
  taxRate?: number;
  totalAmount?: number;
  notes?: string;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

export type ExtractedDocumentData = 
  | InvoiceExtractedData 
  | QuoteExtractedData 
  | SalesOrderExtractedData
  | { documentType: DocumentType.UNKNOWN };

// Processing result
export interface DocumentProcessingResult {
  documentType: DocumentType;
  confidence: number;
  confidenceLevel: ProcessingConfidence;
  extractedText: string;
  extractedData: ExtractedDocumentData;
  processingTime: number; // in milliseconds
}
