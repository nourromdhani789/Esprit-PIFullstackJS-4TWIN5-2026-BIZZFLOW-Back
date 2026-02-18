import { IsString, IsEnum, IsOptional } from 'class-validator';
import { TenantStatus } from '../../shared/enums/tenant-status.enum';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  subdomain?: string;

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;
}
