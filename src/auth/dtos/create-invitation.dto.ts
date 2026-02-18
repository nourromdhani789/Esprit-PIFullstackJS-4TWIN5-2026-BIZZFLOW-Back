import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Role } from '../../shared/enums/role.enum';

export class CreateInvitationDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(Role)
  @IsNotEmpty()
  roleId: Role; // ACCOUNTANT, BUSINESS_ADMIN, or TEAM_MEMBER

  @IsString()
  @IsOptional()
  message?: string; // Optional personalized message
}
