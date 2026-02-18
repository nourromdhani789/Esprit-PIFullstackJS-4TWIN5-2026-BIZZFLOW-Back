import { IsString, IsEnum, IsOptional } from 'class-validator';
import { TenantStatus } from '../../shared/enums/tenant-status.enum';

export class CreateTenantDto {
  @IsString()
  name: string;

  @IsString()
  subdomain: string;

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;
}
