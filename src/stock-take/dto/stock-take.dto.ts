import { IsString, IsOptional, IsEnum, IsISO8601, IsInt, Min, IsUUID } from 'class-validator';
import type { StockTakeStatus } from '../entities/stock-take.entity';

export class CreateStockTakeDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsISO8601()
  countDate?: Date;
}

export class UpdateStockTakeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['draft', 'in_progress', 'completed', 'cancelled'])
  status?: StockTakeStatus;

  @IsOptional()
  @IsISO8601()
  countDate?: Date;
}

export class AddStockTakeItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(0)
  countedQuantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateStockTakeItemDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  countedQuantity?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CompleteStockTakeDto {
  @IsOptional()
  @IsEnum(['adjust', 'review'])
  action: 'adjust' | 'review' = 'review';
}
