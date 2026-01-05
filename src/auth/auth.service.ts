import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcryptjs';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { permission } from 'process';
import { create } from 'domain';
import { last } from 'rxjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (email not verified yet)
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        permissions: [
          'payslips:read',
          'payslips:write',
          'employees:read',
          'employees:write',
          'audit:read',
        ],
        role: 'user',
        emailVerified: false,
      },
    });

    // Send verification email
    await this.sendEmailVerification(user.id, user.email, `${user.firstName} ${user.lastName}`);

    // Generate JWT token
    const access_token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permissions: user.permissions,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        twoFactorEnabled: user.twoFactorEnabled,
        lastLoginAt: user.lastLoginAt,
      },
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    // Check if user account is locked
    if (user.isLocked) {
      throw new UnauthorizedException('Account is locked due to too many failed login attempts. Please contact an administrator.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Increment failed login attempts
      const updatedFailedAttempts = user.failedLoginAttempts + 1;
      const shouldLock = updatedFailedAttempts >= 5;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: updatedFailedAttempts,
          isLocked: shouldLock,
        },
      });

      if (shouldLock) {
        throw new UnauthorizedException(
          'Account is now locked due to too many failed login attempts. Please contact an administrator.',
        );
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Generate and send 2FA token
      const twoFactorToken = await this.generate2FAToken(user.id);

      try {
        await this.emailService.send2FAToken(
          user.email,
          twoFactorToken,
          `${user.firstName} ${user.lastName}`,
        );
      } catch (error) {
        console.error('Failed to send 2FA token email:', error);
        throw new UnauthorizedException('Failed to send 2FA token. Please try again.');
      }

      // Return partial response indicating 2FA is required
      return {
        requiresTwoFactor: true,
        userId: user.id,
        message: 'A verification code has been sent to your email',
      };
    }

    // Reset failed login attempts on successful login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lastLoginAt: new Date(),
      },
    });

    // Generate JWT token
    const access_token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    });

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permissions: user.permissions,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        twoFactorEnabled: user.twoFactorEnabled,
        lastLoginAt: user.lastLoginAt,
      },
    };
  }

  async unlockUser(userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isLocked: false,
        failedLoginAttempts: 0,
      },
    });
  }

  async resetUserPassword(userId: number, newPassword: string) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        failedLoginAttempts: 0,
        isLocked: false,
      },
    });
  }

  /**
   * Generate a 6-digit password reset token and send it via email
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if email exists for security
      return { message: 'If an account exists, a reset email has been sent' };
    }

    // Generate 6-digit random token
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    //hash the token before saving
    const hashedToken = await bcrypt.hash(token+email, 10);

    // Delete any existing password reset tokens for this user
    await this.prisma.passwordReset.deleteMany({
      where: {
        userId: user.id,
      },
    });

    // Create password reset record
    const resetRecord = await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt,
      },
    });

    // Send token via email
    try {
      await this.emailService.sendPasswordResetToken(
        user.email,
        hashedToken,
        `${user.firstName} ${user.lastName}`,
      );
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      // Still return success to user (email issue is internal)
    }

    return { message: 'If an account exists, a reset email has been sent' };
  }

  /**
   * Verify password reset token and reset password
   */
  async resetPasswordWithToken(token: string, newPassword: string) {
    const resetRecord = await this.prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!resetRecord) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check if token has expired
    if (resetRecord.expiresAt < new Date()) {
      // Clean up expired token
      await this.prisma.passwordReset.delete({ where: { id: resetRecord.id } });
      throw new BadRequestException('Reset token has expired');
    }

    // Check if token was already used
    if (resetRecord.usedAt) {
      throw new BadRequestException('Reset token has already been used');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password and mark token as used
    await this.prisma.user.update({
      where: { id: resetRecord.userId },
      data: {
        password: hashedPassword,
        failedLoginAttempts: 0,
        isLocked: false,
      },
    });

    // Mark token as used
    await this.prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    });

    return { message: 'Password reset successfully' };
  }

  async validateUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return user;
  }

  async verifyToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate and send email verification token
   */
  async sendEmailVerification(userId: number, email: string, name: string) {
    // Generate unique verification token
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create verification token record
    await this.prisma.verificationToken.create({
      data: {
        userId,
        token,
        type: 'email_verification',
        expiresAt,
      },
    });

    // Send verification email
    try {
      await this.emailService.sendEmailVerification(email, token, name);
    } catch (error) {
      console.error('Failed to send verification email:', error);
    }

    return { message: 'Verification email sent' };
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string) {
    const verificationRecord = await this.prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationRecord) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Check if token has expired
    if (verificationRecord.expiresAt < new Date()) {
      await this.prisma.verificationToken.delete({ where: { id: verificationRecord.id } });
      throw new BadRequestException('Verification token has expired');
    }

    // Check if token was already used
    if (verificationRecord.usedAt) {
      throw new BadRequestException('Verification token has already been used');
    }

    // Update user email verification status
    await this.prisma.user.update({
      where: { id: verificationRecord.userId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    // Mark token as used
    await this.prisma.verificationToken.update({
      where: { id: verificationRecord.id },
      data: { usedAt: new Date() },
    });

    return { message: 'Email verified successfully' };
  }

  /**
   * Resend email verification
   */
  async resendEmailVerification(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Delete old verification tokens for this user
    await this.prisma.verificationToken.deleteMany({
      where: {
        userId: user.id,
        type: 'email_verification',
      },
    });

    // Send new verification email
    return this.sendEmailVerification(user.id, user.email, `${user.firstName} ${user.lastName}`);
  }

  /**
   * Generate 2FA token (6-digit code)
   */
  async generate2FAToken(userId: number): Promise<string> {
    // Generate 6-digit random token
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing unused 2FA tokens for this user
    await this.prisma.twoFactorToken.deleteMany({
      where: {
        userId,
        usedAt: null,
      },
    });

    // Create 2FA token record
    await this.prisma.twoFactorToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });

    return token;
  }

  /**
   * Verify 2FA token and complete login
   */
  async verify2FAToken(userId: number, token: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokenRecord = await this.prisma.twoFactorToken.findFirst({
      where: {
        userId,
        token,
        usedAt: null,
      },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid 2FA token');
    }

    // Check if token has expired
    if (tokenRecord.expiresAt < new Date()) {
      await this.prisma.twoFactorToken.delete({ where: { id: tokenRecord.id } });
      throw new UnauthorizedException('2FA token has expired');
    }

    // Mark token as used
    await this.prisma.twoFactorToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() },
    });

    // Update last login
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lastLoginAt: new Date(),
      },
    });

    // Generate JWT token
    const access_token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    });

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permissions: user.permissions,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        twoFactorEnabled: user.twoFactorEnabled,
        lastLoginAt: user.lastLoginAt,
      },
    };
  }

  /**
   * Toggle 2FA for a user
   */
  async toggle2FA(userId: number, enabled: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.emailVerified) {
      throw new BadRequestException('Please verify your email before enabling 2FA');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: enabled,
      },
    });

    return {
      twoFactorEnabled: enabled,
      message: `Two-factor authentication ${enabled ? 'enabled' : 'disabled'} successfully`,
    };
  }
}
