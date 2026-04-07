import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AIProcessedDocument } from './entities/ai-processed-document.entity';
import { DocumentProcessingController } from './document-processing.controller';
import { DocumentProcessingService } from './services/document-processing.service';
import { DocumentUploadService } from './services/document-upload.service';
import { DocumentClassificationService } from './services/document-classification.service';
import { OCRService } from './services/ocr.service';
import { DataExtractionService } from './services/data-extraction.service';

/**
 * Document Processing Module
 * 
 * Provides AI-powered document scanning and processing capabilities:
 * - File upload with validation
 * - OCR text extraction
 * - Document classification (invoice, quote, sales order)
 * - Structured data extraction
 * - Multi-tenant document storage
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AIProcessedDocument]),
    ConfigModule,
  ],
  controllers: [DocumentProcessingController],
  providers: [
    DocumentProcessingService,
    DocumentUploadService,
    DocumentClassificationService,
    OCRService,
    DataExtractionService,
  ],
  exports: [DocumentProcessingService],
})
export class DocumentProcessingModule {}
