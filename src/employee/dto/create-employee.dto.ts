import { IsString, IsEmail, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmployeeDto {
  @ApiProperty({ description: 'Unique IPPIS number for the employee' })
  @IsString()
  @IsNotEmpty()
  ippisNumber!: string;

  @ApiProperty({ description: "Employee's first name" })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ description: "Employee's last name" })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ description: "Employee's email address" })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({ description: "Employee's department (optional)" })
  @IsOptional()
  @IsString()
  department?: string;
}
