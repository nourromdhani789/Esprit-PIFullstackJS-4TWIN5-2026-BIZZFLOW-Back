import { InvoiceStatus } from '../entities/invoice.entity';
import { IsString, IsOptional, IsEnum, IsNumber, IsArray, ValidateNested, Min, IsISO8601, IsNotEmpty, IsUUID, IsEmail } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateInvoiceItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  @Transform(({ value }) => Number(value))
  quantity: number;

  @IsNumber()
  @Min(0)
  @Transform(({ value }) => Number(value))
  price: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateInvoiceDto {
  @IsUUID()
  @IsNotEmpty()
  clientId: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: Date;

  @IsOptional()
  @IsString()
  sourceQuoteId?: string;

  @IsOptional()
  @IsString()
  sourceSalesOrderId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];
}

export class UpdateInvoiceDto {
  @IsUUID()
  @IsOptional()
  clientId?: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: Date;
}

export class SendInvoiceEmailDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
