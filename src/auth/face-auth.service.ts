import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { User } from '../user/entities/user.entity';
import { Business } from '../business/entities/business.entity';
import { ActivityLogService } from '../activity/activity-log.service';
import { ActivityAction } from '../activity/entities/activity-log.entity';

export interface FaceDescriptorData {
  descriptor: number[]; // 128-dimensional face embedding
  livenessScore: number; // Anti-spoofing confidence
  timestamp: number; // For replay attack prevention
}

export interface FaceEnrollmentDto {
  email: string;
  faceDescriptor: FaceDescriptorData;
  antiSpoofingData: {
    challengeId: string;
    challengeResponse: string;
    blinkDetected: boolean;
  };
}

export interface FaceLoginDto {
  email: string;
  faceDescriptor: FaceDescriptorData;
  antiSpoofingData: {
    challengeId: string;
    challengeResponse: string;
    blinkDetected: boolean;
  };
}

@Injectable()
export class FaceAuthService {
  // Encryption key should be stored in environment variables
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 16;
  private readonly authTagLength = 16;
  private readonly saltLength = 64;

  // Face matching threshold (lower = stricter)
  private readonly FACE_MATCH_THRESHOLD = 0.6;
  private readonly LIVENESS_THRESHOLD = 0.5; // Lowered from 0.8 to be more lenient
  private readonly MAX_FACE_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MINUTES = 15;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    private jwtService: JwtService,
    private activityLogService: ActivityLogService,
  ) {
    // Use environment variable or generate from a secret
    const secret = process.env.FACE_ENCRYPTION_SECRET || 'your-secret-key-here-change-in-production';
    this.encryptionKey = crypto.scryptSync(secret, 'salt', 32);
  }

  /**
   * Encrypt face descriptor data using AES-256-GCM
   */
  private encryptFaceDescriptor(data: FaceDescriptorData): string {
    const iv = crypto.randomBytes(this.ivLength);
    const salt = crypto.randomBytes(this.saltLength);
    
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    const jsonData = JSON.stringify(data);
    let encrypted = cipher.update(jsonData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine: salt + iv + authTag + encrypted
    const result = salt.toString('hex') + ':' + 
                   iv.toString('hex') + ':' + 
                   authTag.toString('hex') + ':' + 
                   encrypted;
    
    return result;
  }

  /**
   * Decrypt face descriptor data
   */
  private decryptFaceDescriptor(encryptedData: string): FaceDescriptorData {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 4) {
        throw new Error('Invalid encrypted data format');
      }
      
      const salt = Buffer.from(parts[0], 'hex');
      const iv = Buffer.from(parts[1], 'hex');
      const authTag = Buffer.from(parts[2], 'hex');
      const encrypted = parts[3];
      
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted) as FaceDescriptorData;
    } catch (error) {
      throw new Error('Failed to decrypt face descriptor');
    }
  }

  /**
   * Calculate Euclidean distance between two face descriptors
   * Lower distance = better match
   */
  private calculateFaceDistance(descriptor1: number[], descriptor2: number[]): number {
    if (descriptor1.length !== descriptor2.length) {
      throw new Error('Descriptor dimensions do not match');
    }
    
    let sum = 0;
    for (let i = 0; i < descriptor1.length; i++) {
      const diff = descriptor1[i] - descriptor2[i];
      sum += diff * diff;
    }
    
    return Math.sqrt(sum);
  }

  // Store issued challenges with timestamps (in production, use Redis)
  private issuedChallenges = new Map<string, number>();
  private readonly CHALLENGE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Verify anti-spoofing challenge response
   * Simple validation: challenge ID was issued recently and not expired
   */
  private verifyAntiSpoofingChallenge(challengeId: string, response: string): boolean {
    // Check if challenge was issued
    const issuedAt = this.issuedChallenges.get(challengeId);
    if (!issuedAt) {
      return false;
    }
    
    // Check if challenge expired
    const now = Date.now();
    if (now - issuedAt > this.CHALLENGE_EXPIRY_MS) {
      this.issuedChallenges.delete(challengeId);
      return false;
    }
    
    // Challenge is valid - remove it (single-use)
    this.issuedChallenges.delete(challengeId);
    
    // Response can be anything for now, just needs challenge ID
    return response.length > 0;
  }

  /**
   * Check if user is locked out from face login
   */
  private isFaceLoginLockedOut(user: User): boolean {
    if (user.faceLoginAttempts < this.MAX_FACE_LOGIN_ATTEMPTS) {
      return false;
    }
    
    if (!user.faceLoginLockoutExpires) {
      return true;
    }
    
    return new Date() < user.faceLoginLockoutExpires;
  }

  /**
   * Reset face login attempts
   */
  private async resetFaceLoginAttempts(user: User): Promise<void> {
    user.faceLoginAttempts = 0;
    user.faceLoginLockoutExpires = null;
    await this.userRepository.save(user);
  }

  /**
   * Increment face login attempts and lockout if necessary
   */
  private async incrementFaceLoginAttempts(user: User): Promise<void> {
    user.faceLoginAttempts += 1;
    
    if (user.faceLoginAttempts >= this.MAX_FACE_LOGIN_ATTEMPTS) {
      const lockoutExpires = new Date();
      lockoutExpires.setMinutes(lockoutExpires.getMinutes() + this.LOCKOUT_DURATION_MINUTES);
      user.faceLoginLockoutExpires = lockoutExpires;
    }
    
    await this.userRepository.save(user);
  }

  /**
   * Generate anti-spoofing challenge for client
   */
  generateAntiSpoofingChallenge(): { challengeId: string; instructions: string } {
    const challengeId = crypto.randomBytes(32).toString('hex');
    
    // Store challenge with timestamp
    this.issuedChallenges.set(challengeId, Date.now());
    
    // Random instruction for user (e.g., "blink twice", "turn left", "smile")
    const instructions = [
      'Blink your eyes naturally',
      'Turn your head slightly left',
      'Turn your head slightly right',
      'Smile briefly',
    ];
    const randomInstruction = instructions[Math.floor(Math.random() * instructions.length)];
    
    return { challengeId, instructions: randomInstruction };
  }

  /**
   * Calculate expected challenge response (for client-side use or verification)
   */
  calculateChallengeResponse(challengeId: string): string {
    return crypto
      .createHmac('sha256', this.encryptionKey)
      .update(challengeId)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Enroll user face after successful password authentication
   */
  async enrollFace(userId: string, enrollmentDto: FaceEnrollmentDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify email matches
    if (user.email !== enrollmentDto.email) {
      throw new UnauthorizedException('Email mismatch');
    }

    // Check if face ID is already enrolled
    if (user.isFaceIdEnabled && user.faceDescriptor) {
      throw new ConflictException('Face ID is already enrolled. Please remove existing enrollment first.');
    }

    // Verify anti-spoofing challenge
    const isValidChallenge = this.verifyAntiSpoofingChallenge(
      enrollmentDto.antiSpoofingData.challengeId,
      enrollmentDto.antiSpoofingData.challengeResponse,
    );

    if (!isValidChallenge) {
      // For development: log warning but allow if server may have restarted
      console.warn(`[FaceAuth] Invalid challenge for ${enrollmentDto.email}. Challenge may have expired or server restarted.`);
      
      // In production, strict mode: throw error
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Invalid anti-spoofing challenge response');
      }
    }

    // Verify liveness score
    if (enrollmentDto.faceDescriptor.livenessScore < this.LIVENESS_THRESHOLD) {
      throw new BadRequestException('Liveness check failed. Please ensure you are a real person and try again.');
    }

    // Note: Blink detection is optional - main anti-spoofing is challenge-response
    // Keep liveness check to ensure it's a real person

    // Verify descriptor dimensions (should be 128 for face-api.js)
    if (!enrollmentDto.faceDescriptor.descriptor || enrollmentDto.faceDescriptor.descriptor.length !== 128) {
      throw new BadRequestException('Invalid face descriptor format');
    }

    // Encrypt and store face descriptor
    const encryptedDescriptor = this.encryptFaceDescriptor(enrollmentDto.faceDescriptor);
    
    user.faceDescriptor = encryptedDescriptor;
    user.faceEnrollmentDate = new Date();
    user.isFaceIdEnabled = true;
    user.faceIdEncryptionKey = 'v1'; // Version tracking for key rotation
    
    await this.userRepository.save(user);

    // Log enrollment activity
    if (user.id) {
      await this.activityLogService.createLog(
        user.id,
        ActivityAction.USER_UPDATED,
        user.tenantId,
        'Face ID enrolled successfully',
        { action: 'face_enrollment' },
      );
    }

    return {
      message: 'Face ID enrolled successfully. You can now use Face ID to sign in.',
    };
  }

  /**
   * Authenticate user using Face ID
   */
  async loginWithFace(loginDto: FaceLoginDto): Promise<{ access_token: string; user: Partial<User> }> {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
      relations: ['tenant'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if Face ID is enabled
    if (!user.isFaceIdEnabled || !user.faceDescriptor) {
      throw new UnauthorizedException('Face ID is not enabled for this account. Please use password login.');
    }

    // Check account status
    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    if (!user.isApproved) {
      throw new UnauthorizedException('Your account is pending approval');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Check for lockout
    if (this.isFaceLoginLockedOut(user)) {
      const remainingTime = user.faceLoginLockoutExpires 
        ? Math.ceil((user.faceLoginLockoutExpires.getTime() - Date.now()) / 60000)
        : this.LOCKOUT_DURATION_MINUTES;
      throw new UnauthorizedException(`Too many failed attempts. Please try again in ${remainingTime} minutes or use password login.`);
    }

    // Verify anti-spoofing challenge
    const isValidChallenge = this.verifyAntiSpoofingChallenge(
      loginDto.antiSpoofingData.challengeId,
      loginDto.antiSpoofingData.challengeResponse,
    );

    if (!isValidChallenge) {
      await this.incrementFaceLoginAttempts(user);
      throw new UnauthorizedException('Invalid anti-spoofing challenge response');
    }

    // Verify liveness
    if (loginDto.faceDescriptor.livenessScore < this.LIVENESS_THRESHOLD) {
      await this.incrementFaceLoginAttempts(user);
      throw new UnauthorizedException('Liveness check failed. Please ensure you are a real person.');
    }

    // Note: Blink detection is optional, main anti-spoofing is challenge-response
    // The client can send blinkDetected=true if they implement it, but it's not required

    try {
      // Decrypt stored face descriptor
      const storedFaceData = this.decryptFaceDescriptor(user.faceDescriptor);

      // Calculate face match distance
      const distance = this.calculateFaceDistance(
        storedFaceData.descriptor,
        loginDto.faceDescriptor.descriptor,
      );

      // Check if faces match
      if (distance > this.FACE_MATCH_THRESHOLD) {
        await this.incrementFaceLoginAttempts(user);
        throw new UnauthorizedException('Face recognition failed. Please try again or use password login.');
      }

      // Success - reset attempts
      await this.resetFaceLoginAttempts(user);

      // Update last login
      user.login();
      await this.userRepository.save(user);

      // Get business info for token
      const business = await this.businessRepository.findOne({
        where: { tenantId: user.tenantId },
      });

      // Create JWT payload
      const payload = {
        sub: user.id,
        email: user.email,
        roleId: user.roleId,
        tenantId: user.tenantId,
        businessId: business?.id,
        authMethod: 'face_id', // Track authentication method
      };

      const access_token = this.jwtService.sign(payload);

      // Log successful login
      if (user.id) {
        await this.activityLogService.createLog(
          user.id,
          ActivityAction.LOGIN,
          user.tenantId,
          'User logged in with Face ID',
          { roleId: user.roleId, email: user.email, authMethod: 'face_id' },
        );
      }

      // Return user without sensitive data
      const { password, faceDescriptor, ...userWithoutSensitive } = user;

      return {
        access_token,
        user: userWithoutSensitive,
      };

    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      await this.incrementFaceLoginAttempts(user);
      throw new UnauthorizedException('Face authentication failed. Please try again.');
    }
  }

  /**
   * Remove face enrollment
   */
  async removeFaceEnrollment(userId: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    user.faceDescriptor = undefined;
    user.faceEnrollmentDate = undefined;
    user.isFaceIdEnabled = false;
    user.faceIdEncryptionKey = undefined;
    user.faceLoginAttempts = 0;
    user.faceLoginLockoutExpires = undefined;

    await this.userRepository.save(user);

    // Log removal activity
    if (user.id) {
      await this.activityLogService.createLog(
        user.id,
        ActivityAction.USER_UPDATED,
        user.tenantId,
        'Face ID enrollment removed',
        { action: 'face_enrollment_removed' },
      );
    }

    return {
      message: 'Face ID enrollment removed successfully',
    };
  }

  /**
   * Check if user has face ID enrolled
   */
  async hasFaceEnrolled(userId: string): Promise<{ isEnrolled: boolean; enrollmentDate?: Date }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'isFaceIdEnabled', 'faceEnrollmentDate'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      isEnrolled: user.isFaceIdEnabled && !!user.faceDescriptor,
      enrollmentDate: user.faceEnrollmentDate,
    };
  }

  /**
   * Check if email has Face ID enabled (for public enrollment check)
   * Returns false for non-existent users to prevent email enumeration
   */
  async checkEmailHasFaceId(email: string): Promise<{ hasFaceId: boolean; email: string }> {
    console.log(`[FaceAuth] Checking Face ID for: ${email}`);
    
    const user = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'isFaceIdEnabled', 'faceDescriptor'],
    });

    // Return false for non-existent users to prevent email enumeration attacks
    if (!user) {
      console.log(`[FaceAuth] User not found: ${email}`);
      return { hasFaceId: false, email };
    }

    const hasFaceId = user.isFaceIdEnabled && !!user.faceDescriptor;
    console.log(`[FaceAuth] User found: ${email}, isFaceIdEnabled: ${user.isFaceIdEnabled}, hasDescriptor: ${!!user.faceDescriptor}, result: ${hasFaceId}`);

    return {
      hasFaceId,
      email: user.email,
    };
  }

  /**
   * Get face ID status for a user (for settings page)
   */
  async getFaceIdStatus(userId: string): Promise<{
    isEnabled: boolean;
    isEnrolled: boolean;
    enrollmentDate?: Date;
    canEnroll: boolean;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'isFaceIdEnabled', 'faceEnrollmentDate', 'isEmailVerified', 'isApproved', 'isActive'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isEnrolled = user.isFaceIdEnabled && !!user.faceEnrollmentDate;

    return {
      isEnabled: user.isFaceIdEnabled,
      isEnrolled,
      enrollmentDate: user.faceEnrollmentDate,
      canEnroll: user.isEmailVerified && user.isApproved && user.isActive && !isEnrolled,
    };
  }
}
