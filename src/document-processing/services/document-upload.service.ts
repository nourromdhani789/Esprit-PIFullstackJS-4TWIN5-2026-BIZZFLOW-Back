import { Injectable, BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import * as fs from 'fs/promises';

/**
 * Document Upload Configuration
 * 
 * Handles file upload validation and storage configuration
 */

// Allowed file types
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
];

export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];

// File size limits (10MB for images, 20MB for PDFs)
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

// Upload directory
export const UPLOAD_DIR = join(process.cwd(), 'uploads', 'ai-documents');

/**
 * Validate file type and size
 * @param file - Multer file object
 * @throws BadRequestException if validation fails
 */
export function validateDocumentFile(file: Express.Multer.File): void {
  if (!file) {
    throw new BadRequestException('No file provided');
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new BadRequestException(
      `Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`
    );
  }

  // Check extension
  const ext = extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new BadRequestException(
      `Invalid file extension. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`
    );
  }

  // Check size based on type
  const maxSize = file.mimetype === 'application/pdf' ? MAX_FILE_SIZE : MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024);
    throw new BadRequestException(
      `File too large. Maximum size for ${file.mimetype === 'application/pdf' ? 'PDFs' : 'images'}: ${maxSizeMB}MB`
    );
  }

  // Minimum file size check (must have actual content)
  if (file.size < 1024) { // 1KB minimum
    throw new BadRequestException('File is too small or empty');
  }
}

/**
 * Generate a unique filename for storage
 * @param tenantId - Tenant ID for isolation
 * @param originalName - Original filename
 * @returns Unique filename with tenant prefix
 */
export function generateStorageFilename(tenantId: string, originalName: string): string {
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1e9);
  const ext = extname(originalName);
  const safeExt = ALLOWED_EXTENSIONS.includes(ext.toLowerCase()) ? ext : '.bin';
  
  // Include tenant ID in filename for easy identification
  return `doc-${tenantId.substring(0, 8)}-${timestamp}-${random}${safeExt}`;
}

/**
 * Multer storage configuration for document uploads
 */
export const documentStorage = diskStorage({
  destination: (req, file, cb) => {
    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Get tenant ID from request (set by auth guard)
    const tenantId = (req as any).user?.tenantId || 'unknown';
    const filename = generateStorageFilename(tenantId, file.originalname);
    cb(null, filename);
  },
});

/**
 * Multer file filter for document uploads
 */
export function documentFileFilter(
  req: any,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void
): void {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
      ),
      false
    );
  }

  // Check extension
  const ext = extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(
      new BadRequestException(
        `Invalid file extension: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
      ),
      false
    );
  }

  cb(null, true);
}

@Injectable()
export class DocumentUploadService {
  constructor() {
    this.ensureUploadDirectory();
  }

  /**
   * Ensure the upload directory exists
   */
  private ensureUploadDirectory(): void {
    if (!existsSync(UPLOAD_DIR)) {
      mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  /**
   * Delete a file from storage
   * @param filename - Filename to delete
   */
  async deleteFile(filename: string): Promise<void> {
    const filePath = join(UPLOAD_DIR, filename);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist, which is fine
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Get file path for a stored document
   * @param filename - Stored filename
   * @returns Full file path
   */
  getFilePath(filename: string): string {
    return join(UPLOAD_DIR, filename);
  }

  /**
   * Check if file exists
   * @param filename - Filename to check
   */
  async fileExists(filename: string): Promise<boolean> {
    const filePath = join(UPLOAD_DIR, filename);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read file as buffer
   * @param filename - Filename to read
   */
  async readFile(filename: string): Promise<Buffer> {
    const filePath = join(UPLOAD_DIR, filename);
    return fs.readFile(filePath);
  }

  /**
   * Get file stats
   * @param filename - Filename
   */
  async getFileStats(filename: string): Promise<{ size: number; createdAt: Date }> {
    const filePath = join(UPLOAD_DIR, filename);
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      createdAt: stats.birthtime,
    };
  }
}
