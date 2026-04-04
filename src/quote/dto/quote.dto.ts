import { QuoteStatus } from '../entities/quote.entity';
import { IsString, IsOptional, IsEnum, IsNumber, IsArray, ValidateNested, Min, IsISO8601, IsNotEmpty, IsUUID } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateQuoteItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  @Transform(({ value }) => Number(value))
  quantity: number;

  @IsNumber()
  @Min(0)
  @Transform(({ value }) => Number(value))
  unitPrice: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateQuoteDto {
  @IsUUID()
  @IsNotEmpty()
  clientId: string;

  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsISO8601()
  issueDate: Date;

  @IsISO8601()
  expiryDate: Date;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  items: CreateQuoteItemDto[];
}

export class UpdateQuoteDto {
  @IsUUID()
  @IsOptional()
  clientId?: string;

  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsISO8601()
  issueDate?: Date;

  @IsOptional()
  @IsISO8601()
  expiryDate?: Date;
}

export class SendQuoteEmailDto {
  @IsString()
  @IsOptional()
  email?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
