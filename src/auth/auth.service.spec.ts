import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { Business } from '../business/entities/business.entity';
import { Invitation } from './entities/invitation.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { EmailService } from '../shared/services/email.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { Role } from '../shared/enums/role.enum';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashedpassword'),
  compare: jest.fn().mockResolvedValue(true),
}));

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let jwtService: JwtService;

  const mockUserRepository = {
    findOne: jest.fn(), create: jest.fn(), save: jest.fn(), find: jest.fn(),
  };
  const mockTenantRepository = { create: jest.fn(), save: jest.fn() };
  const mockBusinessRepository = { create: jest.fn(), save: jest.fn(), findOne: jest.fn() };
  const mockInvitationRepository = { findOne: jest.fn(), create: jest.fn(), save: jest.fn(), find: jest.fn() };
  const mockJwtService = { sign: jest.fn() };
  const mockEmailService = { sendVerificationEmail: jest.fn(), sendPasswordResetEmail: jest.fn(), sendInvitationEmail: jest.fn() };
  const mockActivityLogService = { createLog: jest.fn() };

  const mockUser = {
    id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@test.com',
    password: 'hashedpassword', phone: '+1234567890', isActive: true,
    isEmailVerified: true, isApproved: true, roleId: Role.BUSINESS_OWNER,
    tenantId: 'tenant-1', login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: getRepositoryToken(Tenant), useValue: mockTenantRepository },
        { provide: getRepositoryToken(Business), useValue: mockBusinessRepository },
        { provide: getRepositoryToken(Invitation), useValue: mockInvitationRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: ActivityLogService, useValue: mockActivityLogService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a business owner', async () => {
      const registerDto = {
        firstName: 'Test', lastName: 'User', email: 'test@test.com',
        password: 'password123', phone: '+1234567890',
        roleId: Role.BUSINESS_OWNER, businessName: 'Test Biz',
      };

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({ ...mockUser, isApproved: true });
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockTenantRepository.create.mockReturnValue({ id: 'tenant-1', name: 'Test Biz' });
      mockTenantRepository.save.mockResolvedValue({ id: 'tenant-1', name: 'Test Biz' });
      mockBusinessRepository.create.mockReturnValue({ id: 'biz-1', name: 'Test Biz' });
      mockBusinessRepository.save.mockResolvedValue({ id: 'biz-1', name: 'Test Biz' });
      mockEmailService.sendVerificationEmail.mockResolvedValue(undefined);

      const result = await service.register(registerDto as any);
      expect(result.message).toContain('Business Owner');
    });

    it('should throw when email exists', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      await expect(service.register({ email: 'test@test.com' } as any)).rejects.toThrow(UnauthorizedException);
    });

    it('should register non-owner with pending approval', async () => {
      const registerDto = {
        firstName: 'Accountant', lastName: 'User', email: 'acc@test.com',
        password: 'password123', roleId: Role.ACCOUNTANT,
      };

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({ ...mockUser, isApproved: false, roleId: Role.ACCOUNTANT });
      mockUserRepository.save.mockResolvedValue({ ...mockUser, isApproved: false, roleId: Role.ACCOUNTANT });
      mockEmailService.sendVerificationEmail.mockResolvedValue(undefined);

      const result = await service.register(registerDto as any);
      expect(result.message).toContain('pending approval');
    });

    it('should handle email sending failure gracefully', async () => {
      const registerDto = {
        firstName: 'Test', lastName: 'User', email: 'test2@test.com',
        password: 'password123', roleId: Role.BUSINESS_OWNER, businessName: 'Biz',
      };

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({ ...mockUser, email: 'test2@test.com' });
      mockUserRepository.save.mockResolvedValue({ ...mockUser, email: 'test2@test.com' });
      mockTenantRepository.create.mockReturnValue({ id: 'tenant-1' });
      mockTenantRepository.save.mockResolvedValue({ id: 'tenant-1' });
      mockBusinessRepository.create.mockReturnValue({ id: 'biz-1' });
      mockBusinessRepository.save.mockResolvedValue({ id: 'biz-1' });
      mockEmailService.sendVerificationEmail.mockRejectedValue(new Error('Email failed'));

      const result = await service.register(registerDto as any);
      expect(result).toBeDefined();
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockBusinessRepository.findOne.mockResolvedValue({ id: 'biz-1', tenantId: 'tenant-1' });
      mockJwtService.sign.mockReturnValue('token');
      mockActivityLogService.createLog.mockResolvedValue(undefined);

      const result = await service.login({ email: 'test@test.com', password: 'password123' } as any);
      expect(result.access_token).toBe('token');
    });

    it('should throw when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      await expect(service.login({ email: 'bad@test.com', password: 'x' } as any)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when email not verified', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, isEmailVerified: false });
      await expect(service.login({ email: 'test@test.com', password: 'password123' } as any)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when not approved', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, isApproved: false });
      await expect(service.login({ email: 'test@test.com', password: 'password123' } as any)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when inactive', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, isActive: false });
      await expect(service.login({ email: 'test@test.com', password: 'password123' } as any)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('resetPassword', () => {
    it('should send reset email', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockEmailService.sendPasswordResetEmail.mockResolvedValue(undefined);

      const result = await service.resetPassword({ email: 'test@test.com' } as any);
      expect(result.message).toContain('reset instructions');
    });

    it('should throw when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      await expect(service.resetPassword({ email: 'bad@test.com' } as any)).rejects.toThrow(UnauthorizedException);
    });

    it('should handle email failure gracefully', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockEmailService.sendPasswordResetEmail.mockRejectedValue(new Error('Email failed'));

      const result = await service.resetPassword({ email: 'test@test.com' } as any);
      expect(result.message).toContain('reset instructions');
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, isEmailVerified: false, emailVerificationToken: 'token123' });
      mockUserRepository.save.mockResolvedValue({ ...mockUser, isEmailVerified: true });

      const result = await service.verifyEmail({ token: 'token123' } as any);
      expect(result.message).toContain('verified');
    });

    it('should throw when token invalid', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      await expect(service.verifyEmail({ token: 'bad' } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    it('should change password', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await service.changePassword('user-1', { currentPassword: 'old', newPassword: 'new' } as any);
      expect(result.message).toContain('changed');
    });

    it('should throw when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      await expect(service.changePassword('bad', { currentPassword: 'old', newPassword: 'new' } as any)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getPendingApprovals', () => {
    it('should return pending users', async () => {
      mockUserRepository.find.mockResolvedValue([{ ...mockUser, isApproved: false, isEmailVerified: true }]);
      const result = await service.getPendingApprovals();
      expect(result.users).toHaveLength(1);
    });
  });

  describe('approveUser', () => {
    it('should approve a user', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, isApproved: false });
      mockUserRepository.save.mockResolvedValue({ ...mockUser, isApproved: true });

      const result = await service.approveUser('user-1', 'admin-1');
      expect(result.message).toContain('approved');
    });

    it('should throw when already approved', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      await expect(service.approveUser('user-1', 'admin-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectUser', () => {
    it('should reject a user', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, isApproved: false });
      mockUserRepository.save.mockResolvedValue({ ...mockUser });

      const result = await service.rejectUser('user-1', 'admin-1');
      expect(result.message).toContain('rejected');
    });
  });

  describe('validateUser', () => {
    it('should return user without password when valid', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUser('test@test.com', 'password123');
      expect(result).toBeDefined();
      expect(result.password).toBeUndefined();
    });

    it('should return null when invalid', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      const result = await service.validateUser('bad@test.com', 'wrong');
      expect(result).toBeNull();
    });
  });

  describe('createInvitation', () => {
    it('should create invitation', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);
      mockInvitationRepository.findOne.mockResolvedValue(null);
      mockInvitationRepository.create.mockReturnValue({ id: 'inv-1', email: 'new@test.com', status: 'PENDING' });
      mockInvitationRepository.save.mockResolvedValue({ id: 'inv-1', email: 'new@test.com', status: 'PENDING' });
      mockEmailService.sendInvitationEmail.mockResolvedValue(undefined);

      const result = await service.createInvitation('user-1', 'tenant-1', { email: 'new@test.com', roleId: Role.ACCOUNTANT } as any);
      expect(result.message).toContain('sent successfully');
    });

    it('should throw when user already exists', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      await expect(service.createInvitation('user-1', 'tenant-1', { email: 'test@test.com', roleId: Role.ACCOUNTANT } as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw for invalid role', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockInvitationRepository.findOne.mockResolvedValue(null);
      await expect(service.createInvitation('user-1', 'tenant-1', { email: 'new@test.com', roleId: Role.BUSINESS_OWNER } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateInvitationToken', () => {
    it('should return valid for valid token', async () => {
      const invitation = { token: 'valid', status: 'PENDING', isExpired: () => false };
      mockInvitationRepository.findOne.mockResolvedValue(invitation);

      const result = await service.validateInvitationToken('valid');
      expect(result.valid).toBe(true);
    });

    it('should return invalid for expired token', async () => {
      mockInvitationRepository.findOne.mockResolvedValue(null);
      const result = await service.validateInvitationToken('bad');
      expect(result.valid).toBe(false);
    });
  });
});
