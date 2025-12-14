import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordWithTokenDto } from './dto/reset-password-with-token.dto';
import { UnlockUserDto } from './dto/unlock-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { VerifyEmailDto, ResendVerificationDto } from './dto/verify-email.dto';
import { Verify2FADto, Toggle2FADto } from './dto/two-factor.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RbacGuard } from './guards/rbac.guard';
import { Permissions } from './decorators/permissions.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { TwoFactorResponseDto } from './dto/two-factor-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully', type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'User with this email already exists' })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user and get JWT token' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto|TwoFactorResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset - sends 6-digit token via email' })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password-with-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using 6-digit token from email' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPasswordWithToken(@Body() resetPasswordWithTokenDto: ResetPasswordWithTokenDto) {
    return this.authService.resetPasswordWithToken(
      resetPasswordWithTokenDto.token,
      resetPasswordWithTokenDto.newPassword,
    );
  }

  @Post('unlock')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('users:write')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlock a user account (Admin only)' })
  @ApiResponse({ status: 200, description: 'User account unlocked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async unlockUser(@Body() unlockUserDto: UnlockUserDto) {
    const result = await this.authService.unlockUser(unlockUserDto.userId);
    return {
      message: 'User account unlocked successfully',
      user: {
        id: result.id,
        email: result.email,
        isLocked: result.isLocked,
      },
    };
  }

  @Post('reset-password')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('users:write')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset user password (Admin only)' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const result = await this.authService.resetUserPassword(resetPasswordDto.userId, resetPasswordDto.newPassword);
    return {
      message: 'Password reset successfully',
      user: {
        id: result.id,
        email: result.email,
        firstName: result.firstName,
        lastName: result.lastName,
      },
    };
  }

  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address with token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification link' })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  @ApiResponse({ status: 400, description: 'User not found or already verified' })
  async resendVerification(@Body() resendVerificationDto: ResendVerificationDto) {
    return this.authService.resendEmailVerification(resendVerificationDto.email);
  }

  @Post('verify-2fa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 2FA token and complete login' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid 2FA token' })
  async verify2FA(@Body() verify2FADto: Verify2FADto) {
    return this.authService.verify2FAToken(verify2FADto.userId, verify2FADto.token);
  }

  @Post('toggle-2fa')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable or disable 2FA for current user' })
  @ApiResponse({ status: 200, description: '2FA toggled successfully' })
  @ApiResponse({ status: 400, description: 'Email not verified' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async toggle2FA(@Body() toggle2FADto: Toggle2FADto, @CurrentUser() user: any) {
    return this.authService.toggle2FA(user.id, toggle2FADto.enabled);
  }
}
