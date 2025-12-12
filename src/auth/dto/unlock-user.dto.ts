import { IsNumber, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UnlockUserDto {
  @ApiProperty({ example: 1, description: 'User ID to unlock' })
  @IsNumber()
  userId!: number;
}
