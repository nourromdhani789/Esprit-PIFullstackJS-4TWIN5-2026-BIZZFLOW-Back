import { IsNumber, IsOptional, IsString, Min, IsDate } from 'class-validator';

export class CreateCreditNoteDto {
  @IsString()
  clientName: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsDate()
  date?: Date;
}

export class UpdateCreditNoteDto {
  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}
