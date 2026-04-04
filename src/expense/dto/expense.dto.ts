import { IsString, IsNumber, IsDateString, IsOptional, IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import type { ExpenseStatus } from '../entities/expense.entity';

export class CreateExpenseDto {
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateExpenseDto {
  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  category?: string;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['pending', 'approved', 'rejected'])
  @IsOptional()
  status?: ExpenseStatus;
}

export class ApproveExpenseDto {
  @IsEnum(['approved', 'rejected'])
  @IsNotEmpty()
  status: 'approved' | 'rejected';
}
