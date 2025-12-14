import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Email verification token',
    example: 'abc123xyz789',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class ResendVerificationDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsString()
  @IsNotEmpty()
  email!: string;
}
