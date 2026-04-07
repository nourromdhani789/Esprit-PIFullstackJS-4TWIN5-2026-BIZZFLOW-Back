import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  UseGuards, 
  Request,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Patch,
  Delete,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../shared/enums/role.enum';
import { DocumentProcessingService } from './services/document-processing.service';
import { DocumentUploadService, validateDocumentFile, documentStorage, documentFileFilter } from './services/document-upload.service';
import { DocumentType, DocumentProcessingStatus } from './types/document-processing.types';
import { CreateDocumentFromScanDto } from './dto/create-document-from-scan.dto';
import { UpdateExtractedDataDto } from './dto/update-extracted-data.dto';

/**
 * Document Processing Controller
 * 
 * Provides API endpoints for the AI document processing pipeline:
 * 
 * POST /document-processing/upload - Upload and process a document
 * GET /document-processing - List processed documents for tenant
 * GET /document-processing/:id - Get specific document details
 * PATCH /document-processing/:id/data - Update extracted data with user corrections
 * POST /document-processing/:id/create-document - Create invoice/quote/SO from scan
 * GET /document-processing/:id/download - Download original file
 * POST /document-processing/:id/retry - Retry processing a failed document
 * DELETE /document-processing/:id - Delete a processed document
 */

@Controller('document-processing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentProcessingController {
  constructor(
    private readonly processingService: DocumentProcessingService,
    private readonly uploadService: DocumentUploadService,
  ) {}

  /**
   * Upload and process a document image
   * 
   * Supports: JPG, PNG, PDF
   * Max size: 10MB (images), 20MB (PDFs)
   * 
   * Returns processing results with extracted text and structured data
   */
  @Post('upload')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  @UseInterceptors(FileInterceptor('file', {
    storage: documentStorage,
    fileFilter: documentFileFilter,
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB max
    },
  }))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
    @Body('businessId') businessId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file
    try {
      validateDocumentFile(file);
    } catch (error) {
      // Clean up uploaded file if validation fails
      await this.uploadService.deleteFile(file.filename);
      throw error;
    }

    // Process the document
    const result = await this.processingService.processDocument(
      file,
      req.user.tenantId,
      req.user.userId,
      businessId,
    );

    return {
      success: true,
      data: {
        documentId: result.documentId,
        documentType: result.documentType,
        confidence: result.confidence,
        confidenceLevel: result.confidenceLevel,
        extractedText: result.extractedText,
        extractedData: result.extractedData,
        processingTime: result.processingTime,
      },
    };
  }

  /**
   * Get all processed documents for the tenant
   * 
   * Query params:
   * - documentType: Filter by type (invoice, quote, sales_order)
   * - status: Filter by status
   * - limit: Number of results (default: 50)
   * - offset: Pagination offset (default: 0)
   */
  @Get()
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async getDocuments(
    @Request() req,
    @Query('documentType') documentType?: DocumentType,
    @Query('status') status?: DocumentProcessingStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const { documents, total } = await this.processingService.getDocumentsByTenant(
      req.user.tenantId,
      {
        documentType,
        status,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      },
    );

    return {
      success: true,
      data: {
        documents: documents.map(doc => this.sanitizeDocument(doc)),
        total,
      },
    };
  }

  /**
   * Get a specific document by ID
   */
  @Get(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async getDocument(
    @Param('id') id: string,
    @Request() req,
  ) {
    const document = await this.processingService.getDocumentById(id, req.user.tenantId);
    
    return {
      success: true,
      data: this.sanitizeDocument(document),
    };
  }

  /**
   * Update extracted data with user corrections
   * 
   * Allows users to fix any errors in the AI-extracted data
   */
  @Patch(':id/data')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async updateExtractedData(
    @Param('id') id: string,
    @Body() dto: UpdateExtractedDataDto,
    @Request() req,
  ) {
    const document = await this.processingService.updateExtractedData(
      id,
      req.user.tenantId,
      dto.correctedData,
    );

    return {
      success: true,
      message: 'Data updated successfully',
      data: this.sanitizeDocument(document),
    };
  }

  /**
   * Create a business document (invoice/quote/sales order) from processed scan
   * 
   * This creates an actual document in the system based on the extracted data
   */
  @Post(':id/create-document')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  async createDocumentFromScan(
    @Param('id') id: string,
    @Body() dto: CreateDocumentFromScanDto,
    @Request() req,
  ) {
    // Note: The actual creation logic would be implemented here
    // For now, we just mark the document as having created a document
    
    const document = await this.processingService.markDocumentCreated(
      id,
      req.user.tenantId,
      dto.createdDocumentId,
      dto.createdDocumentType,
    );

    return {
      success: true,
      message: `Document created from scan: ${dto.createdDocumentType}`,
      data: {
        scanId: document.id,
        createdDocumentId: dto.createdDocumentId,
        createdDocumentType: dto.createdDocumentType,
      },
    };
  }

  /**
   * Download the original uploaded file
   */
  @Get(':id/download')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async downloadDocument(
    @Param('id') id: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const { path, filename, mimeType } = await this.processingService.getDocumentFile(
      id,
      req.user.tenantId,
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(path);
  }

  /**
   * Retry processing a failed document
   */
  @Post(':id/retry')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async retryProcessing(
    @Param('id') id: string,
    @Request() req,
  ) {
    const result = await this.processingService.retryProcessing(
      id,
      req.user.tenantId,
      req.user.userId,
    );

    return {
      success: true,
      message: 'Document reprocessed successfully',
      data: {
        documentId: result.documentId,
        documentType: result.documentType,
        confidence: result.confidence,
        extractedData: result.extractedData,
      },
    };
  }

  /**
   * Delete a processed document and its file
   */
  @Delete(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  async deleteDocument(
    @Param('id') id: string,
    @Request() req,
  ) {
    await this.processingService.deleteDocument(id, req.user.tenantId);

    return {
      success: true,
      message: 'Document deleted successfully',
    };
  }

  // ============ PRIVATE HELPERS ============

  /**
   * Sanitize document entity for API response
   * Removes internal fields and formats data
   */
  private sanitizeDocument(doc: any) {
    return {
      id: doc.id,
      tenantId: doc.tenantId,
      businessId: doc.businessId,
      originalFilename: doc.originalFilename,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      documentType: doc.documentType,
      classificationConfidence: doc.classificationConfidence,
      confidenceLevel: doc.confidenceLevel,
      status: doc.status,
      processingError: doc.processingError,
      processingTimeMs: doc.processingTimeMs,
      extractedText: doc.extractedText?.substring(0, 1000) + (doc.extractedText?.length > 1000 ? '...' : ''), // Truncate for response
      extractedData: doc.extractedData,
      userCorrectedData: doc.userCorrectedData,
      isDataCorrected: doc.isDataCorrected,
      createdDocumentId: doc.createdDocumentId,
      createdDocumentType: doc.createdDocumentType,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
