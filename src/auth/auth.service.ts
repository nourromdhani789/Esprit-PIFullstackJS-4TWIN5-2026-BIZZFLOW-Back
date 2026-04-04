import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '../shared/enums/role.enum';
import { TenantStatus } from '../shared/enums/tenant-status.enum';
import { User } from '../user/entities/user.entity';
import { Invitation } from './entities/invitation.entity';
import { InvitationStatus } from '../shared/enums/invitation-status.enum';
import { Tenant } from '../tenant/entities/tenant.entity';
import { Business } from '../business/entities/business.entity';
import { LoginDto } from './dtos/login.dto';
import { RegisterDto } from './dtos/register.dto';
import { CreateInvitationDto } from './dtos/create-invitation.dto';
import { AcceptInvitationDto } from './dtos/accept-invitation.dto';
import { ResetPasswordDto, ConfirmResetPasswordDto } from './dtos/reset-password.dto';
import { VerifyEmailDto } from './dtos/verify-email.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { jwtConfig } from '../config/jwt.config';
import { EmailService } from '../shared/services/email.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { ActivityAction } from '../activity/entities/activity-log.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    @InjectRepository(Invitation)
    private invitationRepository: Repository<Invitation>,
    private jwtService: JwtService,
    private emailService: EmailService,
    private activityLogService: ActivityLogService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ message: string; user: any }> {
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new UnauthorizedException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const verificationToken = this.generateVerificationToken();
    const emailVerificationExpires = new Date();
    emailVerificationExpires.setHours(emailVerificationExpires.getHours() + 24); // 24 hours expiry

    // Only BUSINESS_OWNER role can register directly without approval
    const isAutoApproved = registerDto.roleId === Role.BUSINESS_OWNER;
    
    const user = this.userRepository.create({
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      email: registerDto.email,
      password: hashedPassword,
      phone: registerDto.phone,
      isActive: false,
      isEmailVerified: false,
      isApproved: isAutoApproved,
      approvedBy: isAutoApproved ? undefined : 'pending-approval',
      approvedAt: isAutoApproved ? new Date() : undefined,
      emailVerificationToken: verificationToken,
      emailVerificationExpires,
      passwordResetToken: undefined,
      passwordResetExpires: undefined,
      roleId: registerDto.roleId,
    }) as any;

    const savedUser = await this.userRepository.save(user);

    // If auto-approved (Business Owner), create tenant and business automatically
    if (isAutoApproved && registerDto.businessName) {
      // Step 1: Create Tenant first
      const newTenant = this.tenantRepository.create({
        name: registerDto.businessName,
        subdomain: registerDto.businessName?.toLowerCase().replace(/\s+/g, '-'),
        status: TenantStatus.ACTIVE,
      });

      const savedTenant = await this.tenantRepository.save(newTenant) as any;

      // Step 2: Update user with tenant ID
      savedUser.tenantId = savedTenant.id;
      await this.userRepository.save(savedUser);

      // Step 3: Create Business with tenantId
      const newBusiness = this.businessRepository.create({
        name: registerDto.businessName,
        tenantId: savedTenant.id,
      });

      await this.businessRepository.save(newBusiness);

      console.log(`Business Owner registered: ${registerDto.businessName}, Tenant: ${savedTenant.id}, Business created`);
    }

    // TODO: Send verification email
    try {
      await this.emailService.sendVerificationEmail(
        savedUser.email,
        savedUser.firstName,
        verificationToken,
      );
      console.log(`Verification email sent to ${savedUser.email}`);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't throw - registration is still successful even if email fails
    }

    const { password, emailVerificationToken: dbVerificationToken, ...userWithoutSensitiveData } = savedUser;

    if (isAutoApproved) {
      return {
        message: 'Business Owner registered successfully. Please check your email for verification.',
        user: userWithoutSensitiveData,
      };
    } else {
      return {
        message: 'Registration submitted successfully. Your account is pending approval by Platform Administrator.',
        user: userWithoutSensitiveData,
      };
    }
  }

  async login(loginDto: LoginDto): Promise<{ access_token: string; user: Partial<User> }> {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
      relations: ['tenant'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    if (!user.isApproved) {
      throw new UnauthorizedException('Your account is pending approval by Platform Administrator');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    user.login();

    await this.userRepository.save(user);

    // Log login activity
    if (user.id) {
      await this.activityLogService.createLog(
        user.id,
        ActivityAction.LOGIN,
        user.tenantId,
        'User logged in successfully',
        { roleId: user.roleId, email: user.email },
      );
    }

    const business = await this.businessRepository.findOne({
      where: { tenantId: user.tenantId },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      tenantId: user.tenantId,
      businessId: business?.id,
    };

    const access_token = this.jwtService.sign(payload);

    const { password, ...userWithoutPassword } = user;

    return {
      access_token,
      user: userWithoutPassword,
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { email: resetPasswordDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('User with this email does not exist');
    }

    const resetToken = this.generateVerificationToken();
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1); // 1 hour expiry

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;

    await this.userRepository.save(user);

    // Send password reset email
    try {
      await this.emailService.sendPasswordResetEmail(user.email, resetToken);
      console.log(`Password reset email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Don't throw - we still return success to prevent email enumeration
    }

    return {
      message: 'Password reset instructions sent to your email',
    };
  }

  async confirmResetPassword(confirmResetDto: ConfirmResetPasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { 
        passwordResetToken: confirmResetDto.token,
        passwordResetExpires: MoreThan(new Date()),
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(confirmResetDto.newPassword, 10);
    user.password = hashedPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;

    await this.userRepository.save(user);

    return {
      message: 'Password reset successfully',
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { 
        emailVerificationToken: verifyEmailDto.token,
        emailVerificationExpires: MoreThan(new Date()),
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    user.isEmailVerified = true;
    user.isActive = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;

    await this.userRepository.save(user);

    return {
      message: 'Email verified successfully',
    };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);
    user.password = hashedNewPassword;

    await this.userRepository.save(user);

    return {
      message: 'Password changed successfully',
    };
  }

  async getPendingApprovals(): Promise<{ users: Partial<User>[] }> {
    const pendingUsers = await this.userRepository.find({
      where: { 
        isApproved: false,
        isEmailVerified: true,
      },
      order: { createdAt: 'ASC' },
    });

    const usersWithoutSensitiveData = pendingUsers.map(user => {
      const { password, emailVerificationToken, ...userWithoutSensitiveData } = user;
      return userWithoutSensitiveData;
    });

    return {
      users: usersWithoutSensitiveData,
    };
  }

  async approveUser(userId: string, adminId: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.isApproved) {
      throw new BadRequestException('User is already approved');
    }

    user.isApproved = true;
    user.approvedBy = adminId;
    user.approvedAt = new Date();
    user.isActive = true;

    await this.userRepository.save(user);

    // TODO: Create tenant for approved user if they are Business Owner
    if (user.roleId === Role.BUSINESS_OWNER) {
      console.log(`Creating tenant for approved Business Owner: ${user.email}`);
    }

    return {
      message: 'User approved successfully',
    };
  }

  async rejectUser(userId: string, adminId: string, reason?: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.isApproved) {
      throw new BadRequestException('User is already approved');
    }

    user.approvedBy = adminId;
    user.approvedAt = new Date();
    // Keep user as not approved but mark rejection reason

    await this.userRepository.save(user);

    return {
      message: 'User rejected successfully',
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['tenant'],
    });

    if (user && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }

    return null;
  }

  private generateVerificationToken(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // ==================== INVITATION METHODS ====================

  async createInvitation(
    inviterId: string,
    inviterTenantId: string,
    createInvitationDto: CreateInvitationDto,
  ): Promise<{ message: string; invitation: Invitation }> {
    // Check if user with this email already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: createInvitationDto.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Check if there's already a pending invitation for this email
    const existingInvitation = await this.invitationRepository.findOne({
      where: {
        email: createInvitationDto.email,
        status: InvitationStatus.PENDING,
        tenantId: inviterTenantId,
      },
    });

    if (existingInvitation) {
      throw new BadRequestException('An active invitation already exists for this email');
    }

    // Validate role - only ACCOUNTANT, BUSINESS_ADMIN, or TEAM_MEMBER can be invited
    const allowedRoles = [Role.ACCOUNTANT, Role.BUSINESS_ADMIN, Role.TEAM_MEMBER];
    if (!allowedRoles.includes(createInvitationDto.roleId)) {
      throw new BadRequestException('Invalid role for invitation. Only ACCOUNTANT, BUSINESS_ADMIN, or TEAM_MEMBER can be invited');
    }

    // Generate invitation token
    const invitationToken = this.generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // 48 hours expiry

    // Create invitation
    const invitation = this.invitationRepository.create({
      email: createInvitationDto.email,
      token: invitationToken,
      invitedBy: inviterId,
      tenantId: inviterTenantId,
      roleId: createInvitationDto.roleId,
      status: InvitationStatus.PENDING,
      expiresAt,
    });

    const savedInvitation = await this.invitationRepository.save(invitation);

    // Send invitation email
    try {
      const inviter = await this.userRepository.findOne({ where: { id: inviterId } });
      const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}` : 'Your Team';
      
      await this.emailService.sendInvitationEmail(
        createInvitationDto.email,
        inviterName,
        invitationToken,
        createInvitationDto.roleId,
        createInvitationDto.message,
      );
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Don't throw - invitation is still created even if email fails
    }

    return {
      message: `Invitation sent successfully to ${createInvitationDto.email}`,
      invitation: savedInvitation,
    };
  }

  async acceptInvitation(
    acceptInvitationDto: AcceptInvitationDto,
  ): Promise<{ message: string; user: any }> {
    // Find the invitation by token and email
    const invitation = await this.invitationRepository.findOne({
      where: {
        token: acceptInvitationDto.token,
        email: acceptInvitationDto.email,
        status: InvitationStatus.PENDING,
      },
    });

    if (!invitation) {
      throw new BadRequestException('Invalid or expired invitation token');
    }

    // Check if invitation is expired
    if (invitation.isExpired()) {
      invitation.status = InvitationStatus.EXPIRED;
      await this.invitationRepository.save(invitation);
      throw new BadRequestException('Invitation has expired');
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: acceptInvitationDto.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(acceptInvitationDto.password, 10);

    // Create user with pre-assigned tenant from invitation
    const user = this.userRepository.create({
      firstName: acceptInvitationDto.firstName,
      lastName: acceptInvitationDto.lastName,
      email: acceptInvitationDto.email,
      password: hashedPassword,
      phone: acceptInvitationDto.phone,
      isActive: true,
      isEmailVerified: true, // Auto-verified since invited
      isApproved: true, // Auto-approved since invited by Business Owner
      approvedBy: invitation.invitedBy,
      approvedAt: new Date(),
      roleId: invitation.roleId,
      tenantId: invitation.tenantId, // Pre-assigned tenant for data isolation
    }) as any;

    const savedUser = await this.userRepository.save(user);

    // Mark invitation as accepted
    invitation.accept(savedUser.id);
    await this.invitationRepository.save(invitation);

    console.log(`User ${acceptInvitationDto.email} joined tenant ${invitation.tenantId} as ${invitation.roleId}`);

    const { password, ...userWithoutSensitiveData } = savedUser;

    return {
      message: 'Invitation accepted successfully. You can now log in.',
      user: userWithoutSensitiveData,
    };
  }

  async getPendingInvitations(tenantId: string): Promise<{ invitations: Invitation[] }> {
    const invitations = await this.invitationRepository.find({
      where: {
        tenantId,
        status: InvitationStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });

    return { invitations };
  }

  async revokeInvitation(
    inviterId: string,
    invitationId: string,
  ): Promise<{ message: string }> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new BadRequestException('Invitation not found');
    }

    // Only the inviter can revoke their own invitations
    if (invitation.invitedBy !== inviterId) {
      throw new UnauthorizedException('You can only revoke invitations you sent');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(`Cannot revoke invitation with status: ${invitation.status}`);
    }

    invitation.revoke();
    await this.invitationRepository.save(invitation);

    return {
      message: `Invitation to ${invitation.email} has been revoked`,
    };
  }

  async validateInvitationToken(token: string): Promise<{ valid: boolean; invitation?: Invitation }> {
    const invitation = await this.invitationRepository.findOne({
      where: {
        token,
        status: InvitationStatus.PENDING,
      },
    });

    if (!invitation || invitation.isExpired()) {
      return { valid: false };
    }

    return { valid: true, invitation };
  }
}
