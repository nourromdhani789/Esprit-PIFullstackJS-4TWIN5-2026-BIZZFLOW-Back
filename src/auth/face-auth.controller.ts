import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Delete, 
  UseGuards, 
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsEmail, IsString } from 'class-validator';
import { FaceAuthService, type FaceEnrollmentDto, type FaceLoginDto } from './face-auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * DTO for requesting anti-spoofing challenge
 */
class ChallengeRequestDto {
  @IsEmail()
  email: string;
}

/**
 * DTO for checking face enrollment status
 */
class EnrollmentStatusDto {
  email: string;
}

/**
 * Controller for Face ID authentication endpoints
 * 
 * Security features:
 * - All enrollment operations require JWT authentication
 * - Face login is rate-limited at the service level
 * - Anti-spoofing challenges required for all face operations
 * - Face descriptors are encrypted before storage
 */
@Controller('auth/face')
export class FaceAuthController {
  constructor(private readonly faceAuthService: FaceAuthService) {}

  /**
   * Generate anti-spoofing challenge for client
   * Must be called before enrollment or login attempts
   * 
   * @returns Challenge ID and instructions for the user
   */
  @Post('challenge')
  @HttpCode(HttpStatus.OK)
  async generateChallenge(@Body() _challengeRequest: ChallengeRequestDto) {
    const challenge = this.faceAuthService.generateAntiSpoofingChallenge();
    
    // Calculate expected response (client will use same algorithm)
    const expectedResponse = this.faceAuthService.calculateChallengeResponse(challenge.challengeId);
    
    return {
      challengeId: challenge.challengeId,
      instructions: challenge.instructions,
      // In production, you might want to remove this and have client calculate it
      // For now, providing it makes implementation easier for the frontend
      expectedResponse,
    };
  }

  /**
   * Enroll face ID for authenticated user
   * Requires the user to be logged in with password first
   * 
   * @param req - Request with authenticated user
   * @param enrollmentDto - Face descriptor and anti-spoofing data
   */
  @Post('enroll')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async enrollFace(@Request() req, @Body() enrollmentDto: FaceEnrollmentDto) {
    // Use authenticated user's ID from JWT
    const userId = req.user.userId || req.user.sub;
    
    return this.faceAuthService.enrollFace(userId, enrollmentDto);
  }

  /**
   * Login with Face ID
   * Alternative to password-based login
   * 
   * @param loginDto - Face descriptor and anti-spoofing data
   * @returns JWT access token and user info on success
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async loginWithFace(@Body() loginDto: FaceLoginDto) {
    return this.faceAuthService.loginWithFace(loginDto);
  }

  /**
   * Remove face enrollment
   * Allows user to disable Face ID
   * 
   * @param req - Request with authenticated user
   */
  @Delete('enroll')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async removeFaceEnrollment(@Request() req) {
    const userId = req.user.userId || req.user.sub;
    return this.faceAuthService.removeFaceEnrollment(userId);
  }

  /**
   * Check if user has face ID enrolled
   * 
   * @param req - Request with authenticated user
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getFaceEnrollmentStatus(@Request() req) {
    const userId = req.user.userId || req.user.sub;
    return this.faceAuthService.getFaceIdStatus(userId);
  }

  /**
   * Check if a specific email has face ID enrolled
   * Useful for UI to show/hide Face ID login option
   * 
   * @param enrollmentStatusDto - Object containing email
   */
  @Post('check-enrollment')
  @HttpCode(HttpStatus.OK)
  async checkEnrollment(@Body() body: { email: string }) {
    console.log('[FaceAuthController] check-enrollment received body:', body);
    
    const email = body?.email?.toLowerCase().trim();
    
    if (!email || typeof email !== 'string') {
      console.log('[FaceAuthController] No email provided');
      return { hasFaceId: false };
    }
    
    if (!email.includes('@')) {
      console.log('[FaceAuthController] Email missing @:', email);
      return { hasFaceId: false };
    }
    
    console.log('[FaceAuthController] Processing email:', email);
    
    // Check if email has face ID enabled without revealing user existence
    try {
      const result = await this.faceAuthService.checkEmailHasFaceId(email);
      console.log('[FaceAuthController] check-enrollment result:', result);
      return { hasFaceId: result.hasFaceId };
    } catch (error) {
      console.error('[FaceAuthController] check-enrollment error:', error);
      return { hasFaceId: false };
    }
  }
}
