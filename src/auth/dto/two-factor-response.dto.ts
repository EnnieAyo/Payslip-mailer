import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorResponseDto {
  @ApiProperty()
  requiresTwoFactor!: boolean;

  @ApiProperty()
  userId!: number;

  @ApiProperty({ required: false })
  message?: string;
}
