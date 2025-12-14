import { IsString, IsArray, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'payroll_manager' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Manages payslip uploads and distribution' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ 
    example: ['payslips:read', 'payslips:write', 'employees:read'],
    description: 'Array of permission strings'
  })
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}
