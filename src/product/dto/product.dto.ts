import { IsString, IsNumber, IsOptional, IsInt, Min, IsEnum } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  initialQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @IsEnum(['sales', 'purchases', 'both'])
  usedFor?: 'sales' | 'purchases' | 'both';

  @IsOptional()
  @IsEnum(['storable', 'consumable', 'service'])
  productType?: 'storable' | 'consumable' | 'service';
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @IsEnum(['sales', 'purchases', 'both'])
  usedFor?: 'sales' | 'purchases' | 'both';

  @IsOptional()
  @IsEnum(['storable', 'consumable', 'service'])
  productType?: 'storable' | 'consumable' | 'service';
}
