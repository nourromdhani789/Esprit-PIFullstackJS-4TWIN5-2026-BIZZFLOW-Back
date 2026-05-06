import { Test, TestingModule } from '@nestjs/testing';
import { FaceAuthService } from './face-auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Business } from '../business/entities/business.entity';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { ActivityLogService } from '../activity/activity-log.service';

describe('FaceAuthService', () => {
  let service: FaceAuthService;

  const mockUser = {
    id: 'user-1', email: 'test@test.com', firstName: 'Test', lastName: 'User',
    roleId: 'admin', tenantId: 'tenant-1', isEmailVerified: true, isApproved: true,
    isActive: true, isFaceIdEnabled: false, faceDescriptor: null,
    faceLoginAttempts: 0, faceLoginLockoutExpires: null,
    login: jest.fn(),
  };

  const mockUserRepo = { findOne: jest.fn(), save: jest.fn() };
  const mockBusinessRepo = { findOne: jest.fn() };
  const mockJwtService = { sign: jest.fn() };
  const mockActivityLogService = { createLog: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaceAuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Business), useValue: mockBusinessRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ActivityLogService, useValue: mockActivityLogService },
      ],
    }).compile();

    service = module.get<FaceAuthService>(FaceAuthService);
    jest.clearAllMocks();
  });

  describe('generateAntiSpoofingChallenge', () => {
    it('should generate a challenge with ID and instructions', () => {
      const result = service.generateAntiSpoofingChallenge();
      expect(result.challengeId).toBeDefined();
      expect(result.instructions).toBeDefined();
      expect(result.challengeId.length).toBe(64);
    });
  });

  describe('calculateChallengeResponse', () => {
    it('should return a 16-char hex string', () => {
      const result = service.calculateChallengeResponse('test-challenge');
      expect(result.length).toBe(16);
    });
  });

  describe('enrollFace', () => {
    const validDescriptor = { descriptor: new Array(128).fill(0.1), livenessScore: 0.9, timestamp: Date.now() };

    it('should enroll face successfully', async () => {
      const challenge = service.generateAntiSpoofingChallenge();
      mockUserRepo.findOne.mockResolvedValue({ ...mockUser });
      mockUserRepo.save.mockImplementation(u => Promise.resolve(u));
      mockActivityLogService.createLog.mockResolvedValue(undefined);

      const result = await service.enrollFace('user-1', {
        email: 'test@test.com',
        faceDescriptor: validDescriptor,
        antiSpoofingData: { challengeId: challenge.challengeId, challengeResponse: 'resp', blinkDetected: true },
      });
      expect(result.message).toContain('successfully');
    });

    it('should throw when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.enrollFace('bad', {
        email: 'test@test.com', faceDescriptor: validDescriptor,
        antiSpoofingData: { challengeId: 'x', challengeResponse: 'r', blinkDetected: true },
      })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when email mismatch', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...mockUser });
      await expect(service.enrollFace('user-1', {
        email: 'wrong@test.com', faceDescriptor: validDescriptor,
        antiSpoofingData: { challengeId: 'x', challengeResponse: 'r', blinkDetected: true },
      })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when face already enrolled', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...mockUser, isFaceIdEnabled: true, faceDescriptor: 'encrypted' });
      await expect(service.enrollFace('user-1', {
        email: 'test@test.com', faceDescriptor: validDescriptor,
        antiSpoofingData: { challengeId: 'x', challengeResponse: 'r', blinkDetected: true },
      })).rejects.toThrow(ConflictException);
    });

    it('should throw when liveness score too low', async () => {
      const challenge = service.generateAntiSpoofingChallenge();
      mockUserRepo.findOne.mockResolvedValue({ ...mockUser });
      const lowLiveness = { ...validDescriptor, livenessScore: 0.1 };
      await expect(service.enrollFace('user-1', {
        email: 'test@test.com', faceDescriptor: lowLiveness,
        antiSpoofingData: { challengeId: challenge.challengeId, challengeResponse: 'r', blinkDetected: true },
      })).rejects.toThrow(BadRequestException);
    });

    it('should throw when descriptor wrong dimensions', async () => {
      const challenge = service.generateAntiSpoofingChallenge();
      mockUserRepo.findOne.mockResolvedValue({ ...mockUser });
      const badDescriptor = { descriptor: [0.1, 0.2], livenessScore: 0.9, timestamp: Date.now() };
      await expect(service.enrollFace('user-1', {
        email: 'test@test.com', faceDescriptor: badDescriptor,
        antiSpoofingData: { challengeId: challenge.challengeId, challengeResponse: 'r', blinkDetected: true },
      })).rejects.toThrow(BadRequestException);
    });
  });

  describe('loginWithFace', () => {
    const validDescriptor = { descriptor: new Array(128).fill(0.1), livenessScore: 0.9, timestamp: Date.now() };

    it('should throw when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.loginWithFace({
        email: 'none@test.com', faceDescriptor: validDescriptor,
        antiSpoofingData: { challengeId: 'x', challengeResponse: 'r', blinkDetected: true },
      })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when face ID not enabled', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...mockUser, isFaceIdEnabled: false });
      await expect(service.loginWithFace({
        email: 'test@test.com', faceDescriptor: validDescriptor,
        antiSpoofingData: { challengeId: 'x', challengeResponse: 'r', blinkDetected: true },
      })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when email not verified', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...mockUser, isFaceIdEnabled: true, faceDescriptor: 'enc', isEmailVerified: false });
      await expect(service.loginWithFace({
        email: 'test@test.com', faceDescriptor: validDescriptor,
        antiSpoofingData: { challengeId: 'x', challengeResponse: 'r', blinkDetected: true },
      })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when account not approved', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...mockUser, isFaceIdEnabled: true, faceDescriptor: 'enc', isApproved: false });
      await expect(service.loginWithFace({
        email: 'test@test.com', faceDescriptor: validDescriptor,
        antiSpoofingData: { challengeId: 'x', challengeResponse: 'r', blinkDetected: true },
      })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when account deactivated', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...mockUser, isFaceIdEnabled: true, faceDescriptor: 'enc', isActive: false });
      await expect(service.loginWithFace({
        email: 'test@test.com', faceDescriptor: validDescriptor,
        antiSpoofingData: { challengeId: 'x', challengeResponse: 'r', blinkDetected: true },
      })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when locked out', async () => {
      const lockoutDate = new Date();
      lockoutDate.setMinutes(lockoutDate.getMinutes() + 10);
      mockUserRepo.findOne.mockResolvedValue({
        ...mockUser, isFaceIdEnabled: true, faceDescriptor: 'enc',
        faceLoginAttempts: 5, faceLoginLockoutExpires: lockoutDate,
      });
      await expect(service.loginWithFace({
        email: 'test@test.com', faceDescriptor: validDescriptor,
        antiSpoofingData: { challengeId: 'x', challengeResponse: 'r', blinkDetected: true },
      })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('removeFaceEnrollment', () => {
    it('should remove face enrollment', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...mockUser, isFaceIdEnabled: true });
      mockUserRepo.save.mockImplementation(u => Promise.resolve(u));
      mockActivityLogService.createLog.mockResolvedValue(undefined);

      const result = await service.removeFaceEnrollment('user-1');
      expect(result.message).toContain('removed');
    });

    it('should throw when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.removeFaceEnrollment('bad')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('hasFaceEnrolled', () => {
    it('should return true when face is enrolled', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', isFaceIdEnabled: true, faceDescriptor: 'enc', faceEnrollmentDate: new Date() });
      const result = await service.hasFaceEnrolled('user-1');
      expect(result.isEnrolled).toBe(true);
    });

    it('should return false when not enrolled', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', isFaceIdEnabled: false, faceDescriptor: null, faceEnrollmentDate: null });
      const result = await service.hasFaceEnrolled('user-1');
      expect(result.isEnrolled).toBe(false);
    });

    it('should throw when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.hasFaceEnrolled('bad')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('checkEmailHasFaceId', () => {
    it('should return true for user with face ID', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', email: 'test@test.com', isFaceIdEnabled: true, faceDescriptor: 'enc' });
      const result = await service.checkEmailHasFaceId('test@test.com');
      expect(result.hasFaceId).toBe(true);
    });

    it('should return false for non-existent user', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const result = await service.checkEmailHasFaceId('none@test.com');
      expect(result.hasFaceId).toBe(false);
    });
  });

  describe('getFaceIdStatus', () => {
    it('should return status for user who can enroll', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-1', isFaceIdEnabled: false, faceEnrollmentDate: null,
        isEmailVerified: true, isApproved: true, isActive: true,
      });
      const result = await service.getFaceIdStatus('user-1');
      expect(result.isEnabled).toBe(false);
      expect(result.canEnroll).toBe(true);
    });

    it('should return enrolled status', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-1', isFaceIdEnabled: true, faceEnrollmentDate: new Date(),
        isEmailVerified: true, isApproved: true, isActive: true,
      });
      const result = await service.getFaceIdStatus('user-1');
      expect(result.isEnrolled).toBe(true);
      expect(result.canEnroll).toBe(false);
    });

    it('should throw when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.getFaceIdStatus('bad')).rejects.toThrow(UnauthorizedException);
    });
  });
});
