import { Controller, Post, Body, Get, UseGuards, Request, Param, Delete, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { User } from '../user/entities/user.entity';
import { LoginDto } from './dtos/login.dto';
import { RegisterDto } from './dtos/register.dto';
import { CreateInvitationDto } from './dtos/create-invitation.dto';
import { AcceptInvitationDto } from './dtos/accept-invitation.dto';
import { ResetPasswordDto, ConfirmResetPasswordDto } from './dtos/reset-password.dto';
import { VerifyEmailDto } from './dtos/verify-email.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { Role } from '../shared/enums/role.enum';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('confirm-reset-password')
  async confirmResetPassword(@Body() confirmResetDto: ConfirmResetPasswordDto) {
    return this.authService.confirmResetPassword(confirmResetDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    const user = await this.userRepository.findOne({
      where: { id: req.user.userId },
      relations: ['tenant'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  @Post('verify-email')
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Request() req, @Body() changePasswordDto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.userId, changePasswordDto);
  }

  @Get('pending-approvals')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN)
  async getPendingApprovals() {
    return this.authService.getPendingApprovals();
  }

  @Post('approve-user/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN)
  async approveUser(@Param('userId') userId: string, @Request() req) {
    return this.authService.approveUser(userId, req.user.userId);
  }

  @Post('reject-user/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN)
  async rejectUser(@Param('userId') userId: string, @Request() req) {
    return this.authService.rejectUser(userId, req.user.userId);
  }

  // ==================== INVITATION ENDPOINTS ====================

  @Post('invite')
  @UseGuards(JwtAuthGuard)
  async createInvitation(@Request() req, @Body() createInvitationDto: CreateInvitationDto) {
    return this.authService.createInvitation(
      req.user.userId,
      req.user.tenantId,
      createInvitationDto,
    );
  }

  @Post('accept-invitation')
  async acceptInvitation(@Body() acceptInvitationDto: AcceptInvitationDto) {
    return this.authService.acceptInvitation(acceptInvitationDto);
  }

  @Get('invitations/pending')
  @UseGuards(JwtAuthGuard)
  async getPendingInvitations(@Request() req) {
    return this.authService.getPendingInvitations(req.user.tenantId);
  }

  @Delete('invitations/:invitationId')
  @UseGuards(JwtAuthGuard)
  async revokeInvitation(@Param('invitationId') invitationId: string, @Request() req) {
    return this.authService.revokeInvitation(req.user.userId, invitationId);
  }

  @Get('invitations/validate/:token')
  async validateInvitationToken(@Param('token') token: string) {
    return this.authService.validateInvitationToken(token);
  }
}
