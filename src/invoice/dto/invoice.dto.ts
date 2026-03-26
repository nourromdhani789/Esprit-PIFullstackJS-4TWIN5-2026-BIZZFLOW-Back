import { InvoiceStatus } from '../entities/invoice.entity';
import { IsString, IsOptional, IsEnum, IsNumber, IsArray, ValidateNested, Min, IsISO8601 } from 'class-validator';
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
  @IsString()
  clientId: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  clientEmail?: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: Date;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];
}

export class UpdateInvoiceDto {
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  status?: InvoiceStatus;
  notes?: string;
  dueDate?: Date;
}

export class SendInvoiceEmailDto {
  email: string;
  subject?: string;
  message?: string;
}
