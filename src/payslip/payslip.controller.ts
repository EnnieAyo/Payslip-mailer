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
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiParam } from '@nestjs/swagger';
import { PayslipDto, PayslipUploadDto, UploadResultDto } from './dto/payslip.dto';

@ApiTags('Payslips')
@Controller('payslips')
export class PayslipController {
  constructor(private readonly payslipService: PayslipService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload bulk payslips (PDF)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @ApiResponse({ status: 201, description: 'Upload processed', type: UploadResultDto })
  async uploadPayslips(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const lower = file.originalname.toLowerCase();
    if (!lower.endsWith('.pdf') && !lower.endsWith('.zip')) {
      throw new BadRequestException('Only PDF or ZIP files are allowed');
    }

    return this.payslipService.uploadAndDistribute(
      file.buffer,
      file.originalname,
    );
  }

  @Get('upload/:uploadId')
  @ApiOperation({ summary: 'Get upload status by uploadId' })
  @ApiParam({ name: 'uploadId', description: 'Upload identifier' })
  @ApiResponse({ status: 200, description: 'Upload status retrieved', type: PayslipUploadDto })
  async getUploadStatus(@Param('uploadId') uploadId: string) {
    return this.payslipService.getUploadStatus(uploadId);
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Get payslips by employee ID' })
  @ApiParam({ name: 'employeeId', description: 'Employee numeric ID' })
  @ApiResponse({ status: 200, description: 'Payslips for employee', type: PayslipDto, isArray: true })
  async getPayslipsByEmployee(@Param('employeeId') employeeId: string) {
    return this.payslipService.getPayslipsByEmployee(+employeeId);
  }

  @Get('unsent')
  @ApiOperation({ summary: 'Get unsent payslips' })
  @ApiResponse({ status: 200, description: 'Unsent payslips', type: PayslipDto, isArray: true })
  async getUnsentPayslips() {
    return this.payslipService.getUnsentPayslips();
  }

  @Post('resend/:payslipId')
  @ApiOperation({ summary: 'Resend a payslip by payslip ID' })
  @ApiParam({ name: 'payslipId', description: 'Payslip numeric ID' })
  @ApiResponse({ status: 200, description: 'Payslip resent (returns payslip)', type: PayslipDto })
  async resendPayslip(@Param('payslipId') payslipId: string) {
    return this.payslipService.resendPayslip(+payslipId);
  }
}
