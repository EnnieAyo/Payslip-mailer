import { IsString, MinLength, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordWithTokenDto {
  @ApiProperty({ example: '123456', description: '6-digit reset token' })
  @IsString()
  @Length(6, 6)
  token!: string;

  @ApiProperty({ example: 'newPassword123', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
