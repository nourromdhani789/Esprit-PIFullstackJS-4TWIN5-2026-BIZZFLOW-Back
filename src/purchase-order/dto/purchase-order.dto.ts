import { IsOptional, IsString, IsNumber, IsEnum, IsISO8601, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { PurchaseOrderStatus } from '../entities/purchase-order.entity';

export class PurchaseOrderItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreatePurchaseOrderDto {
  @IsString()
  supplierName: string;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsOptional()
  @IsEnum(['pending', 'received', 'cancelled'])
  status?: PurchaseOrderStatus;

  @IsOptional()
  @IsISO8601()
  date?: Date;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items?: PurchaseOrderItemDto[];
}

export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsString()
  supplierName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @IsOptional()
  @IsEnum(['pending', 'received', 'cancelled'])
  status?: PurchaseOrderStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReceivePurchaseOrderDto {
  @IsISO8601()
  receivedDate: Date;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}
