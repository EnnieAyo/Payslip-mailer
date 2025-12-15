import { IsString, IsEmail, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkEmployeeDto {
  @ApiProperty({ description: 'Employee IPPIS number', example: 'IPP123456' })
  @IsString()
  @IsNotEmpty()
  ippisNumber!: string;

  @ApiProperty({ description: 'Employee first name', example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ description: 'Employee last name', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ description: 'Employee email address', example: 'john.doe@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ description: 'Employee department', example: 'IT Department', required: false })
  @IsString()
  @IsOptional()
  department?: string;
}

export class BulkUploadResultDto {
  @ApiProperty({ description: 'Total number of records in the file' })
  totalRecords!: number;

  @ApiProperty({ description: 'Number of successfully imported records' })
  successCount!: number;

  @ApiProperty({ description: 'Number of failed records' })
  failureCount!: number;

  @ApiProperty({ description: 'List of errors encountered during import' })
  errors!: Array<{
    row: number;
    ippisNumber?: string;
    errors: string[];
  }>;

  @ApiProperty({ description: 'Upload processing time in milliseconds' })
  processingTime!: number;
}
