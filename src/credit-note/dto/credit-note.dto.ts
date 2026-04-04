import { IsNumber, IsOptional, IsString, Min, IsDate, IsEnum, IsUUID } from 'class-validator';

export class CreateCreditNoteDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsString()
  clientName: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsEnum(['returned_goods', 'pricing_error', 'product_expired_or_damaged', 'service_not_delivered', 'partial_refund', 'other'])
  reason: string;

  @IsOptional()
  @IsString()
  reasonDetails?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsDate()
  date?: Date;
}

export class UpdateCreditNoteDto {
  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsEnum(['returned_goods', 'pricing_error', 'product_expired_or_damaged', 'service_not_delivered', 'partial_refund', 'other'])
  reason?: string;

  @IsOptional()
  @IsString()
  reasonDetails?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;
}
