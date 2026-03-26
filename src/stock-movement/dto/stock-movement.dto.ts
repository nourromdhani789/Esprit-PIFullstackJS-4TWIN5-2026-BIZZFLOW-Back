import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import type { StockMovementType, StockMovementReason } from '../entities/stock-movement.entity';

export class CreateStockMovementDto {
  @IsUUID()
  productId: string;

  @IsEnum(['IN', 'OUT'])
  type: StockMovementType;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsEnum(['purchase', 'sale', 'adjustment', 'return', 'damage', 'initial'])
  reason: StockMovementReason;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  date?: Date;

  @IsOptional()
  @IsUUID()
  referenceId?: string;
}

export class UpdateStockMovementDto {
  @IsOptional()
  @IsEnum(['IN', 'OUT'])
  type?: StockMovementType;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsEnum(['purchase', 'sale', 'adjustment', 'return', 'damage'])
  reason?: StockMovementReason;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class StockMovementFilterDto {
  @IsOptional()
  @IsEnum(['IN', 'OUT'])
  type?: StockMovementType;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  startDate?: Date;

  @IsOptional()
  endDate?: Date;
}
