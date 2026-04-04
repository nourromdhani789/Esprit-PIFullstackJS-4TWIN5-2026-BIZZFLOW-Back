import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { TenantStatus } from '../../shared/enums/tenant-status.enum';

export class CreateBusinessDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  legalName: string;

  @IsOptional()
  @IsString()
  taxNumber: string;

  @IsOptional()
  @IsString()
  currency: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  taxRate: number;

  @IsOptional()
  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  website: string;

  @IsOptional()
  @IsString()
  logoUrl: string;

  @IsOptional()
  @IsString()
  primaryColor: string;

  @IsOptional()
  @IsString()
  secondaryColor: string;

  @IsOptional()
  @IsString()
  accentColor: string;

  @IsEnum(TenantStatus)
  status?: TenantStatus;
}
