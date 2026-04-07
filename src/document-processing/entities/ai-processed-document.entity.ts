import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  Index
} from 'typeorm';
import { DocumentType, DocumentProcessingStatus, ProcessingConfidence } from '../types/document-processing.types';

/**
 * AI Processed Document Entity
 * 
 * Stores documents processed by the AI pipeline:
 * - Original file metadata
 * - Classification results
 * - Extracted text and structured data
 * - Multi-tenant isolation via tenant_id
 */
@Entity('ai_processed_documents')
@Index(['tenantId', 'createdAt'])
@Index(['documentType', 'tenantId'])
@Index(['status', 'tenantId'])
export class AIProcessedDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Multi-tenant isolation - CRITICAL
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'business_id', type: 'uuid', nullable: true })
  businessId: string;

  @Column({ name: 'uploaded_by_user_id', type: 'uuid' })
  uploadedByUserId: string;

  // Original file information
  @Column({ name: 'original_filename' })
  originalFilename: string;

  @Column({ name: 'stored_filename' })
  storedFilename: string;

  @Column({ name: 'file_path' })
  filePath: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'file_size', type: 'int' })
  fileSize: number; // in bytes

  // Document classification
  @Column({
    type: 'enum',
    enum: DocumentType,
    default: DocumentType.UNKNOWN,
  })
  documentType: DocumentType;

  @Column({ name: 'classification_confidence', type: 'decimal', precision: 5, scale: 4, default: 0 })
  classificationConfidence: number; // 0-1 scale

  @Column({
    type: 'enum',
    enum: ProcessingConfidence,
    default: ProcessingConfidence.LOW,
  })
  confidenceLevel: ProcessingConfidence;

  // Processing status
  @Column({
    type: 'enum',
    enum: DocumentProcessingStatus,
    default: DocumentProcessingStatus.PENDING,
  })
  status: DocumentProcessingStatus;

  @Column({ name: 'processing_error', type: 'text', nullable: true })
  processingError: string;

  @Column({ name: 'processing_time_ms', type: 'int', nullable: true })
  processingTimeMs: number;

  // OCR results
  @Column({ name: 'extracted_text', type: 'longtext', nullable: true })
  extractedText: string;

  // Structured data extraction (JSON)
  @Column({ name: 'extracted_data', type: 'json', nullable: true })
  extractedData: Record<string, any>;

  // User corrections (if user edits the extracted data)
  @Column({ name: 'user_corrected_data', type: 'json', nullable: true })
  userCorrectedData: Record<string, any>;

  @Column({ name: 'is_data_corrected', type: 'boolean', default: false })
  isDataCorrected: boolean;

  // Document creation status (if user created a document from this)
  @Column({ name: 'created_document_id', type: 'uuid', nullable: true })
  createdDocumentId: string;

  @Column({ name: 'created_document_type', nullable: true })
  createdDocumentType: string; // 'invoice', 'quote', 'sales_order'

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
