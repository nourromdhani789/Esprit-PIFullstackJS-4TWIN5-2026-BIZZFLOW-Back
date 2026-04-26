import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { Business } from '../business/entities/business.entity';
import { Invitation } from './entities/invitation.entity';
import { EmailService } from '../shared/services/email.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { Role } from '../shared/enums/role.enum';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Repository<User>>;
  let tenantRepository: jest.Mocked<Repository<Tenant>>;
  let businessRepository: jest.Mocked<Repository<Business>>;
  let invitationRepository: jest.Mocked<Repository<Invitation>>;
  let jwtService: jest.Mocked<JwtService>;
  let emailService: jest.Mocked<EmailService>;
  let activityLogService: jest.Mocked<ActivityLogService>;

  const mockUserRepository = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  });

  const mockTenantRepository = () => ({
    create: jest.fn(),
    save: jest.fn(),
  });

  const mockBusinessRepository = () => ({
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  });

  const mockInvitationRepository = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository(),
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository(),
        },
        {
          provide: getRepositoryToken(Business),
          useValue: mockBusinessRepository(),
        },
        {
          provide: getRepositoryToken(Invitation),
          useValue: mockInvitationRepository(),
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendVerificationEmail: jest.fn(),
            sendPasswordResetEmail: jest.fn(),
            sendInvitationEmail: jest.fn(),
          },
        },
        {
          provide: ActivityLogService,
          useValue: {
            createLog: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    tenantRepository = module.get(getRepositoryToken(Tenant));
    businessRepository = module.get(getRepositoryToken(Business));
    invitationRepository = module.get(getRepositoryToken(Invitation));
    jwtService = module.get(JwtService);
    emailService = module.get(EmailService);
    activityLogService = module.get(ActivityLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'password123',
      phone: '+1234567890',
      roleId: Role.BUSINESS_OWNER,
      businessName: 'Test Business',
    };

    it('should throw UnauthorizedException if user already exists', async () => {
      userRepository.findOne.mockResolvedValue({ id: '1' } as User);

      await expect(service.register(registerDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should successfully register a business owner with tenant and business', async () => {
      userRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      
      const savedUser = {
        id: 'user-1',
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        password: 'hashedPassword',
        emailVerificationToken: 'token',
        isApproved: true,
      };
      userRepository.create.mockReturnValue(savedUser as User);
      userRepository.save.mockResolvedValue(savedUser as User);

      const savedTenant = { id: 'tenant-1', name: registerDto.businessName };
      tenantRepository.create.mockReturnValue(savedTenant as Tenant);
      tenantRepository.save.mockResolvedValue(savedTenant as Tenant);

      const savedBusiness = { id: 'business-1', name: registerDto.businessName };
      businessRepository.create.mockReturnValue(savedBusiness as Business);
      businessRepository.save.mockResolvedValue(savedBusiness as Business);

      emailService.sendVerificationEmail.mockResolvedValue(undefined);

      const result = await service.register(registerDto);

      expect(result.message).toContain('Business Owner registered successfully');
      expect(result.user).toBeDefined();
      expect(tenantRepository.create).toHaveBeenCalled();
      expect(businessRepository.create).toHaveBeenCalled();
    });

    it('should register non-business owner with pending approval', async () => {
      const accountantRegister = { ...registerDto, roleId: Role.ACCOUNTANT, businessName: undefined };
      userRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      
      const savedUser = {
        id: 'user-1',
        email: accountantRegister.email,
        isApproved: false,
      };
      userRepository.create.mockReturnValue(savedUser as User);
      userRepository.save.mockResolvedValue(savedUser as User);

      emailService.sendVerificationEmail.mockResolvedValue(undefined);

      const result = await service.register(accountantRegister);

      expect(result.message).toContain('pending approval');
      expect(tenantRepository.create).not.toHaveBeenCalled();
    });

    it('should handle email sending failure gracefully', async () => {
      userRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      
      const savedUser = { id: 'user-1', email: registerDto.email, isApproved: true };
      userRepository.create.mockReturnValue(savedUser as User);
      userRepository.save.mockResolvedValue(savedUser as User);

      tenantRepository.create.mockReturnValue({ id: 'tenant-1' } as Tenant);
      tenantRepository.save.mockResolvedValue({ id: 'tenant-1' } as Tenant);
      businessRepository.create.mockReturnValue({ id: 'business-1' } as Business);
      businessRepository.save.mockResolvedValue({ id: 'business-1' } as Business);

      emailService.sendVerificationEmail.mockRejectedValue(new Error('Email failed'));

      const result = await service.register(registerDto);

      expect(result.user).toBeDefined();
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'john@example.com',
      password: 'password123',
    };

    it('should throw UnauthorizedException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      const user = {
        id: 'user-1',
        email: loginDto.email,
        password: 'hashedPassword',
        isEmailVerified: true,
        isApproved: true,
        isActive: true,
      };
      userRepository.findOne.mockResolvedValue(user as User);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if email not verified', async () => {
      const user = {
        id: 'user-1',
        email: loginDto.email,
        password: 'hashedPassword',
        isEmailVerified: false,
      };
      userRepository.findOne.mockResolvedValue(user as User);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        'Please verify your email before logging in',
      );
    });

    it('should throw UnauthorizedException if account not approved', async () => {
      const user = {
        id: 'user-1',
        email: loginDto.email,
        password: 'hashedPassword',
        isEmailVerified: true,
        isApproved: false,
      };
      userRepository.findOne.mockResolvedValue(user as User);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        'Your account is pending approval by Platform Administrator',
      );
    });

    it('should throw UnauthorizedException if account is deactivated', async () => {
      const user = {
        id: 'user-1',
        email: loginDto.email,
        password: 'hashedPassword',
        isEmailVerified: true,
        isApproved: true,
        isActive: false,
      };
      userRepository.findOne.mockResolvedValue(user as User);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        'Account is deactivated',
      );
    });

    it('should successfully login and return access token', async () => {
      const user = {
        id: 'user-1',
        email: loginDto.email,
        password: 'hashedPassword',
        firstName: 'John',
        lastName: 'Doe',
        roleId: Role.BUSINESS_OWNER,
        tenantId: 'tenant-1',
        isEmailVerified: true,
        isApproved: true,
        isActive: true,
        login: jest.fn(),
      };
      userRepository.findOne.mockResolvedValue(user as unknown as User);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      businessRepository.findOne.mockResolvedValue({ id: 'business-1' } as Business);
      jwtService.sign.mockReturnValue('jwt-token');

      const result = await service.login(loginDto);

      expect(result.access_token).toBe('jwt-token');
      expect(result.user).toBeDefined();
      expect(user.login).toHaveBeenCalled();
      expect(activityLogService.createLog).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword({ email: 'test@example.com' }),
      ).rejects.toThrow('User with this email does not exist');
    });

    it('should successfully initiate password reset', async () => {
      const user = { id: 'user-1', email: 'test@example.com' };
      userRepository.findOne.mockResolvedValue(user as User);
      userRepository.save.mockResolvedValue(user as User);
      emailService.sendPasswordResetEmail.mockResolvedValue(undefined);

      const result = await service.resetPassword({ email: user.email });

      expect(result.message).toContain('Password reset instructions sent');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should handle email failure gracefully', async () => {
      const user = { id: 'user-1', email: 'test@example.com' };
      userRepository.findOne.mockResolvedValue(user as User);
      userRepository.save.mockResolvedValue(user as User);
      emailService.sendPasswordResetEmail.mockRejectedValue(new Error('Email failed'));

      const result = await service.resetPassword({ email: user.email });

      expect(result.message).toContain('Password reset instructions sent');
    });
  });

  describe('confirmResetPassword', () => {
    it('should throw BadRequestException for invalid token', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.confirmResetPassword({ token: 'invalid', newPassword: 'newpass' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully reset password', async () => {
      const user = {
        id: 'user-1',
        passwordResetToken: 'valid-token',
        passwordResetExpires: new Date(Date.now() + 3600000),
      };
      userRepository.findOne.mockResolvedValue(user as User);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
      userRepository.save.mockResolvedValue({ ...user, password: 'newHashedPassword' } as User);

      const result = await service.confirmResetPassword({
        token: 'valid-token',
        newPassword: 'newPassword123',
      });

      expect(result.message).toBe('Password reset successfully');
      expect(userRepository.save).toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('should throw BadRequestException for invalid token', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.verifyEmail({ token: 'invalid' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully verify email', async () => {
      const user = {
        id: 'user-1',
        emailVerificationToken: 'valid-token',
        emailVerificationExpires: new Date(Date.now() + 3600000),
      };
      userRepository.findOne.mockResolvedValue(user as User);
      userRepository.save.mockResolvedValue({ ...user, isEmailVerified: true } as User);

      const result = await service.verifyEmail({ token: 'valid-token' });

      expect(result.message).toBe('Email verified successfully');
    });
  });

  describe('changePassword', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'oldpass',
          newPassword: 'newpass',
        }),
      ).rejects.toThrow('User not found');
    });

    it('should throw UnauthorizedException if current password is wrong', async () => {
      const user = { id: 'user-1', password: 'hashedPassword' };
      userRepository.findOne.mockResolvedValue(user as User);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'wrongpass',
          newPassword: 'newpass',
        }),
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should successfully change password', async () => {
      const user = { id: 'user-1', password: 'hashedPassword' };
      userRepository.findOne.mockResolvedValue(user as User);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
      userRepository.save.mockResolvedValue({ ...user, password: 'newHashedPassword' } as User);

      const result = await service.changePassword('user-1', {
        currentPassword: 'oldpass',
        newPassword: 'newpass',
      });

      expect(result.message).toBe('Password changed successfully');
    });
  });

  describe('approveUser', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.approveUser('user-1', 'admin-1')).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw BadRequestException if user already approved', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'user-1', isApproved: true } as User);

      await expect(service.approveUser('user-1', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should successfully approve user', async () => {
      const user = { id: 'user-1', isApproved: false, roleId: Role.ACCOUNTANT };
      userRepository.findOne.mockResolvedValue(user as User);
      userRepository.save.mockResolvedValue({ ...user, isApproved: true } as User);

      const result = await service.approveUser('user-1', 'admin-1');

      expect(result.message).toBe('User approved successfully');
    });
  });

  describe('getPendingApprovals', () => {
    it('should return pending users without sensitive data', async () => {
      const users = [
        { id: '1', email: 'user1@test.com', password: 'secret', isApproved: false, isEmailVerified: true },
        { id: '2', email: 'user2@test.com', password: 'secret', isApproved: false, isEmailVerified: true },
      ];
      userRepository.find.mockResolvedValue(users as User[]);

      const result = await service.getPendingApprovals();

      expect(result.users).toHaveLength(2);
      expect(result.users[0]).not.toHaveProperty('password');
    });
  });
});
