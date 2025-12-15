import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class PayslipDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  uuid!: string;

  @ApiProperty()
  ippisNumber!: string;

  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  filePath!: string;

  // pdfContent intentionally omitted from public DTO

  @ApiProperty()
  employeeId!: number;

  @ApiProperty()
  uploadId!: number;

  @ApiProperty()
  payMonth!: string;

  @ApiProperty()
  emailSent!: boolean;

  @ApiProperty({ required: false })
  emailSentAt?: Date;

  @ApiProperty({ required: false })
  emailError?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PayslipUploadDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  uuid!: string;

  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  filePath!: string;

  @ApiProperty()
  payMonth!: string;

  @ApiProperty()
  totalFiles!: number;

  @ApiProperty()
  processedFiles!: number;

  @ApiProperty()
  successCount!: number;

  @ApiProperty()
  failureCount!: number;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  emailStatus!: string;

  @ApiProperty({ required: false })
  sentAt?: Date;

  @ApiProperty({ required: false })
  completedAt?: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class UploadPayslipDto {
  @ApiProperty({
    description: 'Pay month in YYYY-MM format (e.g., 2025-12)',
    example: '2025-12',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'payMonth must be in YYYY-MM format (e.g., 2025-12)',
  })
  payMonth!: string;
}

export class UploadResultDto {
  @ApiProperty()
  uploadId!: number;

  @ApiProperty()
  batchId!: string;

  @ApiProperty()
  processedFiles!: number;

  @ApiProperty()
  failedFiles!: number;

  @ApiProperty()
  totalFiles!: number;

  @ApiProperty()
  payMonth!: string;
}

export class BatchSendResultDto {
  @ApiProperty()
  batchId!: string;

  @ApiProperty()
  payMonth!: string;

  @ApiProperty()
  totalPayslips!: number;

  @ApiProperty()
  successCount!: number;

  @ApiProperty()
  failureCount!: number;

  @ApiProperty({ required: false })
  skippedCount?: number;

  @ApiProperty()
  emailStatus!: string;

  @ApiProperty({ required: false })
  message?: string;

  @ApiProperty()
  sentAt!: Date;

  @ApiProperty()
  completedAt!: Date;
}
