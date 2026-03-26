import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, IsDate, Min } from 'class-validator';
import type { PaymentType, PaymentMethod } from '../entities/payment.entity';

export class CreatePaymentDto {
  @IsEnum(['IN', 'OUT'])
  type: PaymentType;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsEnum(['cash', 'bank', 'card', 'check', 'transfer'])
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDate()
  date?: Date;
}

export class UpdatePaymentDto {
  @IsOptional()
  @IsEnum(['IN', 'OUT'])
  type?: PaymentType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsEnum(['cash', 'bank', 'card', 'check', 'transfer'])
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class PaymentFilterDto {
  @IsOptional()
  @IsEnum(['IN', 'OUT'])
  type?: PaymentType;

  @IsOptional()
  @IsEnum(['cash', 'bank', 'card', 'check', 'transfer'])
  method?: PaymentMethod;

  @IsOptional()
  startDate?: Date;

  @IsOptional()
  endDate?: Date;
}
