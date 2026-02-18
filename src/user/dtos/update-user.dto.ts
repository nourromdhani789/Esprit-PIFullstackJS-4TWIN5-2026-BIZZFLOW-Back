import { IsString, IsEmail, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Role } from '../../shared/enums/role.enum';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(Role)
  roleId?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
