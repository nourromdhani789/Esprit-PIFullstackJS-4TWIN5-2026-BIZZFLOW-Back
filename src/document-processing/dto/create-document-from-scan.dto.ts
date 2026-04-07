import { IsString, IsObject, IsOptional, IsUUID } from 'class-validator';

/**
 * DTO for creating a document from a scanned document
 */
export class CreateDocumentFromScanDto {
  @IsString()
  createdDocumentType: 'invoice' | 'quote' | 'sales_order';

  @IsUUID()
  createdDocumentId: string;

  @IsObject()
  @IsOptional()
  corrections?: Record<string, any>;
}
