import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Role } from '../shared/enums/role.enum';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let userRepository: jest.Mocked<any>;

  const mockAuthService = () => ({
    register: jest.fn(),
    login: jest.fn(),
    resetPassword: jest.fn(),
    confirmResetPassword: jest.fn(),
    verifyEmail: jest.fn(),
    changePassword: jest.fn(),
    getPendingApprovals: jest.fn(),
    approveUser: jest.fn(),
    rejectUser: jest.fn(),
    createInvitation: jest.fn(),
    acceptInvitation: jest.fn(),
    getPendingInvitations: jest.fn(),
    revokeInvitation: jest.fn(),
    validateInvitationToken: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService(),
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    userRepository = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const registerDto = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
        phone: '+1234567890',
        roleId: Role.BUSINESS_OWNER,
        businessName: 'Test Business',
      };

      const expectedResult = {
        message: 'Business Owner registered successfully',
        user: { id: 'user-1', email: registerDto.email },
      };

      authService.register.mockResolvedValue(expectedResult);

      const result = await controller.register(registerDto);

      expect(result).toEqual(expectedResult);
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });

    it('should handle registration errors', async () => {
      const registerDto = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
        roleId: Role.BUSINESS_OWNER,
      };

      authService.register.mockRejectedValue(new UnauthorizedException('User already exists'));

      await expect(controller.register(registerDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('POST /auth/login', () => {
    it('should login user and return access token', async () => {
      const loginDto = {
        email: 'john@example.com',
        password: 'password123',
      };

      const expectedResult = {
        access_token: 'jwt-token',
        user: { id: 'user-1', email: loginDto.email },
      };

      authService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(loginDto);

      expect(result).toEqual(expectedResult);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
    });

    it('should handle invalid credentials', async () => {
      const loginDto = {
        email: 'john@example.com',
        password: 'wrongpassword',
      };

      authService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      await expect(controller.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should initiate password reset', async () => {
      const resetDto = { email: 'john@example.com' };
      const expectedResult = { message: 'Password reset instructions sent to your email' };

      authService.resetPassword.mockResolvedValue(expectedResult);

      const result = await controller.resetPassword(resetDto);

      expect(result).toEqual(expectedResult);
      expect(authService.resetPassword).toHaveBeenCalledWith(resetDto);
    });
  });

  describe('POST /auth/confirm-reset-password', () => {
    it('should confirm password reset', async () => {
      const confirmDto = { token: 'reset-token', newPassword: 'newPassword123' };
      const expectedResult = { message: 'Password reset successfully' };

      authService.confirmResetPassword.mockResolvedValue(expectedResult);

      const result = await controller.confirmResetPassword(confirmDto);

      expect(result).toEqual(expectedResult);
      expect(authService.confirmResetPassword).toHaveBeenCalledWith(confirmDto);
    });
  });

  describe('GET /auth/profile', () => {
    it('should return user profile', async () => {
      const mockRequest = {
        user: { userId: 'user-1' },
      };

      const user = {
        id: 'user-1',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      userRepository.findOne.mockResolvedValue(user);

      const result = await controller.getProfile(mockRequest as any);

      expect(result).toEqual(user);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        relations: ['tenant'],
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      const mockRequest = {
        user: { userId: 'user-1' },
      };

      userRepository.findOne.mockResolvedValue(null);

      await expect(controller.getProfile(mockRequest as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('POST /auth/verify-email', () => {
    it('should verify email', async () => {
      const verifyDto = { token: 'verification-token' };
      const expectedResult = { message: 'Email verified successfully' };

      authService.verifyEmail.mockResolvedValue(expectedResult);

      const result = await controller.verifyEmail(verifyDto);

      expect(result).toEqual(expectedResult);
      expect(authService.verifyEmail).toHaveBeenCalledWith(verifyDto);
    });
  });

  describe('POST /auth/change-password', () => {
    it('should change password', async () => {
      const mockRequest = { user: { userId: 'user-1' } };
      const changeDto = { currentPassword: 'oldpass', newPassword: 'newpass' };
      const expectedResult = { message: 'Password changed successfully' };

      authService.changePassword.mockResolvedValue(expectedResult);

      const result = await controller.changePassword(mockRequest as any, changeDto);

      expect(result).toEqual(expectedResult);
      expect(authService.changePassword).toHaveBeenCalledWith('user-1', changeDto);
    });
  });

  describe('GET /auth/pending-approvals', () => {
    it('should return pending approvals (admin only)', async () => {
      const expectedResult = {
        users: [
          { id: 'user-1', email: 'pending@test.com', isApproved: false },
        ],
      };

      authService.getPendingApprovals.mockResolvedValue(expectedResult);

      const result = await controller.getPendingApprovals();

      expect(result).toEqual(expectedResult);
    });
  });

  describe('POST /auth/approve-user/:userId', () => {
    it('should approve user (admin only)', async () => {
      const mockRequest = { user: { userId: 'admin-1' } };
      const expectedResult = { message: 'User approved successfully' };

      authService.approveUser.mockResolvedValue(expectedResult);

      const result = await controller.approveUser('user-1', mockRequest as any);

      expect(result).toEqual(expectedResult);
      expect(authService.approveUser).toHaveBeenCalledWith('user-1', 'admin-1');
    });
  });

  describe('POST /auth/reject-user/:userId', () => {
    it('should reject user (admin only)', async () => {
      const mockRequest = { user: { userId: 'admin-1' } };
      const expectedResult = { message: 'User rejected successfully' };

      authService.rejectUser.mockResolvedValue(expectedResult);

      const result = await controller.rejectUser('user-1', mockRequest as any);

      expect(result).toEqual(expectedResult);
      expect(authService.rejectUser).toHaveBeenCalledWith('user-1', 'admin-1');
    });
  });

  describe('Invitation Endpoints', () => {
    describe('POST /auth/invite', () => {
      it('should create invitation', async () => {
        const mockRequest = {
          user: { userId: 'inviter-1', tenantId: 'tenant-1' },
        };
        const inviteDto = {
          email: 'invited@example.com',
          roleId: Role.ACCOUNTANT,
          message: 'Join our team',
        };
        const expectedResult = {
          message: 'Invitation sent successfully',
          invitation: { id: 'invite-1', email: inviteDto.email } as any,
        };

        authService.createInvitation.mockResolvedValue(expectedResult);

        const result = await controller.createInvitation(mockRequest as any, inviteDto);

        expect(result).toEqual(expectedResult);
        expect(authService.createInvitation).toHaveBeenCalledWith(
          'inviter-1',
          'tenant-1',
          inviteDto,
        );
      });
    });

    describe('POST /auth/accept-invitation', () => {
      it('should accept invitation', async () => {
        const acceptDto = {
          token: 'invite-token',
          email: 'invited@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          password: 'password123',
          phone: '+1234567890',
        };
        const expectedResult = {
          message: 'Invitation accepted successfully',
          user: { id: 'user-1', email: acceptDto.email },
        };

        authService.acceptInvitation.mockResolvedValue(expectedResult);

        const result = await controller.acceptInvitation(acceptDto);

        expect(result).toEqual(expectedResult);
        expect(authService.acceptInvitation).toHaveBeenCalledWith(acceptDto);
      });
    });

    describe('GET /auth/invitations/pending', () => {
      it('should get pending invitations', async () => {
        const mockRequest = { user: { tenantId: 'tenant-1' } };
        const expectedResult = {
          invitations: [{ id: 'invite-1', email: 'test@example.com', status: 'PENDING' }] as any[],
        };

        authService.getPendingInvitations.mockResolvedValue(expectedResult);

        const result = await controller.getPendingInvitations(mockRequest as any);

        expect(result).toEqual(expectedResult);
        expect(authService.getPendingInvitations).toHaveBeenCalledWith('tenant-1');
      });
    });

    describe('DELETE /auth/invitations/:invitationId', () => {
      it('should revoke invitation', async () => {
        const mockRequest = { user: { userId: 'user-1' } };
        const expectedResult = { message: 'Invitation revoked' };

        authService.revokeInvitation.mockResolvedValue(expectedResult);

        const result = await controller.revokeInvitation('invite-1', mockRequest as any);

        expect(result).toEqual(expectedResult);
        expect(authService.revokeInvitation).toHaveBeenCalledWith('user-1', 'invite-1');
      });
    });

    describe('GET /auth/invitations/validate/:token', () => {
      it('should validate invitation token', async () => {
        const expectedResult = { valid: true, invitation: { id: 'invite-1' } as any };

        authService.validateInvitationToken.mockResolvedValue(expectedResult);

        const result = await controller.validateInvitationToken('token-123');

        expect(result).toEqual(expectedResult);
        expect(authService.validateInvitationToken).toHaveBeenCalledWith('token-123');
      });
    });
  });
});
