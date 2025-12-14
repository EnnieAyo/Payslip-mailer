import { IsString, IsNotEmpty, IsNumber, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Verify2FADto {
  @ApiProperty({
    description: 'User ID',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  userId!: number;

  @ApiProperty({
    description: '6-digit 2FA token',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class Toggle2FADto {
  @ApiProperty({
    description: 'Enable or disable 2FA',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  enabled!: boolean;
}
