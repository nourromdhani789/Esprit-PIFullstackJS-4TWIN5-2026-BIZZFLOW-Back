import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AIProcessedDocument } from '../entities/ai-processed-document.entity';
import { 
  DocumentType, 
  DocumentProcessingStatus, 
  ProcessingConfidence,
  DocumentProcessingResult 
} from '../types/document-processing.types';
import { DocumentUploadService } from './document-upload.service';
import { DocumentClassificationService } from './document-classification.service';
import { OCRService } from './ocr.service';
import { DataExtractionService } from './data-extraction.service';

/**
 * Document Processing Orchestrator
 * 
 * Coordinates the entire AI document processing pipeline:
 * 1. File validation and storage
 * 2. OCR text extraction
 * 3. Document classification
 * 4. Structured data extraction
 * 5. Result storage with tenant isolation
 * 
 * All operations are tenant-isolated using tenantId from the request.
 */

interface ProcessingOptions {
  skipClassification?: boolean;
  skipDataExtraction?: boolean;
}

@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  constructor(
    @InjectRepository(AIProcessedDocument)
    private readonly documentRepository: Repository<AIProcessedDocument>,
    private readonly uploadService: DocumentUploadService,
    private readonly classificationService: DocumentClassificationService,
    private readonly ocrService: OCRService,
    private readonly dataExtractionService: DataExtractionService,
  ) {}

  /**
   * Process a newly uploaded document through the full pipeline
   * 
   * @param file - Uploaded file
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param userId - ID of user who uploaded the document
   * @param businessId - Optional business ID
   * @param options - Processing options
   * @returns Processing result with extracted data
   */
  async processDocument(
    file: Express.Multer.File,
    tenantId: string,
    userId: string,
    businessId?: string,
    options: ProcessingOptions = {},
  ): Promise<DocumentProcessingResult & { documentId: string }> {
    const startTime = Date.now();
    
    this.logger.log(`Starting document processing for tenant ${tenantId}, user ${userId}`);

    // Step 1: Create initial record
    const document = this.documentRepository.create({
      tenantId,
      businessId,
      uploadedByUserId: userId,
      originalFilename: file.originalname,
      storedFilename: file.filename,
      filePath: file.path,
      mimeType: file.mimetype,
      fileSize: file.size,
      status: DocumentProcessingStatus.PENDING,
      documentType: DocumentType.UNKNOWN,
      classificationConfidence: 0,
      confidenceLevel: ProcessingConfidence.LOW,
    });

    const saved = await this.documentRepository.save(document);

    try {
      // Step 2: Extract text using OCR
      await this.updateStatus(saved.id, DocumentProcessingStatus.EXTRACTING_TEXT);
      const ocrResult = await this.ocrService.extractText(file.path, file.mimetype);
      
      saved.extractedText = ocrResult.text;
      await this.documentRepository.save(saved);

      let documentType = DocumentType.UNKNOWN;
      let classificationConfidence = 0;

      // Step 3: Classify document (unless skipped)
      if (!options.skipClassification) {
        await this.updateStatus(saved.id, DocumentProcessingStatus.CLASSIFYING);
        const classification = await this.classificationService.classifyDocument(ocrResult.text);
        
        documentType = classification.documentType;
        classificationConfidence = classification.confidence;
        
        saved.documentType = documentType;
        saved.classificationConfidence = classificationConfidence;
        saved.confidenceLevel = classification.confidenceLevel;
        await this.documentRepository.save(saved);
      }

      // Step 4: Extract structured data (unless skipped)
      let extractedData: any = { documentType };
      
      if (!options.skipDataExtraction && documentType !== DocumentType.UNKNOWN) {
        await this.updateStatus(saved.id, DocumentProcessingStatus.EXTRACTING_DATA);
        
        const extraction = await this.dataExtractionService.extractData(
          ocrResult.text, 
          documentType
        );
        
        extractedData = extraction.data;
        saved.extractedData = extractedData;
        await this.documentRepository.save(saved);
      }

      // Step 5: Mark as completed
      const processingTime = Date.now() - startTime;
      await this.completeProcessing(saved.id, processingTime);

      this.logger.log(`Document ${saved.id} processed successfully in ${processingTime}ms`);

      return {
        documentId: saved.id,
        documentType,
        confidence: classificationConfidence,
        confidenceLevel: saved.confidenceLevel,
        extractedText: ocrResult.text,
        extractedData,
        processingTime,
      };

    } catch (error) {
      this.logger.error(`Document processing failed for ${saved.id}:`, error);
      await this.failProcessing(saved.id, (error as Error).message);
      throw error;
    }
  }

  /**
   * Get all processed documents for a tenant
   */
  async getDocumentsByTenant(
    tenantId: string,
    options: {
      documentType?: DocumentType;
      status?: DocumentProcessingStatus;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ documents: AIProcessedDocument[]; total: number }> {
    const { documentType, status, limit = 50, offset = 0 } = options;

    const queryBuilder = this.documentRepository
      .createQueryBuilder('doc')
      .where('doc.tenantId = :tenantId', { tenantId });

    if (documentType) {
      queryBuilder.andWhere('doc.documentType = :documentType', { documentType });
    }

    if (status) {
      queryBuilder.andWhere('doc.status = :status', { status });
    }

    const [documents, total] = await queryBuilder
      .orderBy('doc.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { documents, total };
  }

  /**
   * Get a single document by ID (with tenant verification)
   */
  async getDocumentById(documentId: string, tenantId: string): Promise<AIProcessedDocument> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, tenantId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  /**
   * Update extracted data with user corrections
   */
  async updateExtractedData(
    documentId: string,
    tenantId: string,
    correctedData: Record<string, any>,
  ): Promise<AIProcessedDocument> {
    const document = await this.getDocumentById(documentId, tenantId);
    
    document.userCorrectedData = correctedData;
    document.isDataCorrected = true;
    
    return this.documentRepository.save(document);
  }

  /**
   * Mark document as having created a business document
   */
  async markDocumentCreated(
    documentId: string,
    tenantId: string,
    createdDocumentId: string,
    createdDocumentType: string,
  ): Promise<AIProcessedDocument> {
    const document = await this.getDocumentById(documentId, tenantId);
    
    document.createdDocumentId = createdDocumentId;
    document.createdDocumentType = createdDocumentType;
    
    return this.documentRepository.save(document);
  }

  /**
   * Delete a processed document and its file
   */
  async deleteDocument(documentId: string, tenantId: string): Promise<void> {
    const document = await this.getDocumentById(documentId, tenantId);
    
    // Delete the physical file
    await this.uploadService.deleteFile(document.storedFilename);
    
    // Delete the database record
    await this.documentRepository.remove(document);
    
    this.logger.log(`Deleted document ${documentId}`);
  }

  /**
   * Get document file for download
   */
  async getDocumentFile(documentId: string, tenantId: string): Promise<{ path: string; filename: string; mimeType: string }> {
    const document = await this.getDocumentById(documentId, tenantId);
    
    return {
      path: this.uploadService.getFilePath(document.storedFilename),
      filename: document.originalFilename,
      mimeType: document.mimeType,
    };
  }

  /**
   * Retry processing a failed document
   */
  async retryProcessing(
    documentId: string, 
    tenantId: string,
    userId: string,
  ): Promise<DocumentProcessingResult & { documentId: string }> {
    const document = await this.getDocumentById(documentId, tenantId);
    
    // Reset status
    document.status = DocumentProcessingStatus.PENDING;
    (document as any).processingError = null;
    await this.documentRepository.save(document);

    // Check if file still exists
    const fileExists = await this.uploadService.fileExists(document.storedFilename);
    if (!fileExists) {
      throw new NotFoundException('Original file not found, cannot retry');
    }

    // Read file and create a mock Multer file object
    const fileBuffer = await this.uploadService.readFile(document.storedFilename);
    const fileStats = await this.uploadService.getFileStats(document.storedFilename);

    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: document.originalFilename,
      encoding: '7bit',
      mimetype: document.mimeType,
      size: fileStats.size,
      destination: '',
      filename: document.storedFilename,
      path: this.uploadService.getFilePath(document.storedFilename),
      buffer: fileBuffer,
      stream: null as any,
    };

    return this.processDocument(mockFile, tenantId, userId, document.businessId);
  }

  // ============ PRIVATE HELPERS ============

  private async updateStatus(documentId: string, status: DocumentProcessingStatus): Promise<void> {
    await this.documentRepository.update(documentId, { status });
  }

  private async completeProcessing(documentId: string, processingTimeMs: number): Promise<void> {
    await this.documentRepository.update(documentId, {
      status: DocumentProcessingStatus.COMPLETED,
      processingTimeMs,
    });
  }

  private async failProcessing(documentId: string, errorMessage: string): Promise<void> {
    await this.documentRepository.update(documentId, {
      status: DocumentProcessingStatus.FAILED,
      processingError: errorMessage,
    });
  }
}
