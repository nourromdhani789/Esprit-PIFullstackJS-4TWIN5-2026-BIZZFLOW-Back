import { SalesOrderStatus } from '../entities/sales-order.entity';
import { IsString, IsOptional, IsEnum, IsNumber, IsArray, ValidateNested, Min, IsISO8601, IsNotEmpty, IsUUID } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateSalesOrderItemDto {
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

export class CreateSalesOrderDto {
  @IsUUID()
  @IsNotEmpty()
  clientId: string;

  @IsOptional()
  @IsEnum(SalesOrderStatus)
  status?: SalesOrderStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsISO8601()
  issueDate: Date;

  @IsOptional()
  @IsISO8601()
  expectedDeliveryDate?: Date;

  @IsOptional()
  @IsString()
  sourceQuoteId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesOrderItemDto)
  items: CreateSalesOrderItemDto[];
}

export class UpdateSalesOrderDto {
  @IsUUID()
  @IsOptional()
  clientId?: string;

  @IsOptional()
  @IsEnum(SalesOrderStatus)
  status?: SalesOrderStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsISO8601()
  issueDate?: Date;

  @IsOptional()
  @IsISO8601()
  expectedDeliveryDate?: Date;
}

export class SendSalesOrderEmailDto {
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
