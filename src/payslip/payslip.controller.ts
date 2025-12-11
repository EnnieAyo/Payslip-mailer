import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PayslipService } from './payslip.service';

@Controller('payslips')
export class PayslipController {
  constructor(private readonly payslipService: PayslipService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPayslips(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!file.originalname.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('Only PDF files are allowed');
    }

    return this.payslipService.uploadAndDistribute(
      file.buffer,
      file.originalname,
    );
  }

  @Get('upload/:uploadId')
  async getUploadStatus(@Param('uploadId') uploadId: string) {
    return this.payslipService.getUploadStatus(uploadId);
  }

  @Get('employee/:employeeId')
  async getPayslipsByEmployee(@Param('employeeId') employeeId: string) {
    return this.payslipService.getPayslipsByEmployee(+employeeId);
  }

  @Get('unsent')
  async getUnsentPayslips() {
    return this.payslipService.getUnsentPayslips();
  }

  @Post('resend/:payslipId')
  async resendPayslip(@Param('payslipId') payslipId: string) {
    return this.payslipService.resendPayslip(+payslipId);
  }
}
