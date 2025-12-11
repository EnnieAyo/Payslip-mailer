import { ApiProperty } from '@nestjs/swagger';

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
  emailSent!: boolean;

  @ApiProperty({ required: false })
  emailSentAt?: Date;

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
  totalFiles!: number;

  @ApiProperty()
  successCount!: number;

  @ApiProperty()
  failureCount!: number;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class UploadResultDto {
  @ApiProperty()
  uploadId!: string;

  @ApiProperty()
  successCount!: number;

  @ApiProperty()
  failureCount!: number;

  @ApiProperty()
  totalFiles!: number;
}
