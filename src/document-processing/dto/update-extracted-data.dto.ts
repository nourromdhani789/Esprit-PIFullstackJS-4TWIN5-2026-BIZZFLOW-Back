import { IsObject } from 'class-validator';

/**
 * DTO for updating extracted data with user corrections
 */
export class UpdateExtractedDataDto {
  @IsObject()
  correctedData: Record<string, any>;
}
