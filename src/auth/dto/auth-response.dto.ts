import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty()
  access_token!: string;

  @ApiProperty()
  user!: {
    id: number;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    role: string;
    permissions: string[];
    emailVerified: boolean;
    emailVerifiedAt: Date|null;
    twoFactorEnabled?: boolean;
    lastLoginAt: Date|null;
  };
}
