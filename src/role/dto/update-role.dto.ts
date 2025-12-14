import { IsString, IsArray, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'payroll_manager' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Manages payslip uploads and distribution' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: ['payslips:read', 'payslips:write', 'employees:read'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}
