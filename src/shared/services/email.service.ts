import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'oussemadenguir999@gmail.com',
        pass: 'dosv hhgf irdy ueht',
      },
    });
  }

  async sendInvitationEmail(
    to: string,
    inviterName: string,
    invitationToken: string,
    role: string,
    message?: string,
  ): Promise<void> {
    const acceptUrl = `http://localhost:5173/accept-invitation?token=${invitationToken}&email=${encodeURIComponent(to)}`;

    const roleLabels: Record<string, string> = {
      ACCOUNTANT: 'Accountant',
      BUSINESS_ADMIN: 'Business Admin',
      TEAM_MEMBER: 'Team Member',
    };

    const mailOptions = {
      from: 'oussemadenguir999@gmail.com',
      to,
      subject: `You've been invited to join ${inviterName}'s team!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">You're Invited!</h2>
          <p>Hello,</p>
          <p><strong>${inviterName}</strong> has invited you to join their team as a <strong>${roleLabels[role] || role}</strong>.</p>
          ${message ? `<p style="background: #f5f5f5; padding: 10px; border-left: 4px solid #007bff;">${message}</p>` : ''}
          <p>Click the button below to accept your invitation and create your account:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${acceptUrl}" 
               style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">This invitation will expire in 48 hours.</p>
          <p style="color: #666; font-size: 12px;">If the button doesn't work, copy and paste this link: ${acceptUrl}</p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendWelcomeEmail(to: string, firstName: string): Promise<void> {
    const mailOptions = {
      from: 'oussemadenguir999@gmail.com',
      to,
      subject: 'Welcome to the team!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Welcome ${firstName}!</h2>
          <p>Your invitation has been accepted and your account is now active.</p>
          <p>You can now log in and start collaborating with your team.</p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: 'oussemadenguir999@gmail.com',
      to,
      subject: 'Reset Your Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hello,</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
          <p style="color: #666; font-size: 12px;">If the button doesn't work, copy and paste this link: ${resetUrl}</p>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendVerificationEmail(to: string, firstName: string, verificationToken: string): Promise<void> {
    const verifyUrl = `http://localhost:5173/verify-email?token=${verificationToken}`;

    const mailOptions = {
      from: 'oussemadenguir999@gmail.com',
      to,
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Welcome ${firstName}!</h2>
          <p>Thank you for signing up. Please verify your email address to complete your registration.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" 
               style="background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
          <p style="color: #666; font-size: 12px;">If the button doesn't work, copy and paste this link: ${verifyUrl}</p>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">If you didn't create an account, please ignore this email.</p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }
}
