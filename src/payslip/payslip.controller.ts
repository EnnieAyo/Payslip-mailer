import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PayslipService } from './payslip.service';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { PayslipDto, PayslipUploadDto, UploadResultDto } from './dto/payslip.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Payslips')
@Controller('payslips')
export class PayslipController {
  constructor(private readonly payslipService: PayslipService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('payslips:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload bulk payslips (PDF or ZIP)' })
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
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async uploadPayslips(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
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
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('payslips:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get upload status by uploadId' })
  @ApiParam({ name: 'uploadId', description: 'Upload identifier' })
  @ApiResponse({ status: 200, description: 'Upload status retrieved', type: PayslipUploadDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async getUploadStatus(@Param('uploadId') uploadId: string) {
    return this.payslipService.getUploadStatus(uploadId);
  }

  @Get('employee/:employeeId')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('payslips:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payslips by employee ID' })
  @ApiParam({ name: 'employeeId', description: 'Employee numeric ID' })
  @ApiResponse({ status: 200, description: 'Payslips for employee', type: PayslipDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async getPayslipsByEmployee(@Param('employeeId') employeeId: string) {
    return this.payslipService.getPayslipsByEmployee(+employeeId);
  }

  @Get('unsent')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('payslips:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unsent payslips' })
  @ApiResponse({ status: 200, description: 'Unsent payslips', type: PayslipDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async getUnsentPayslips() {
    return this.payslipService.getUnsentPayslips();
  }

  @Post('resend/:payslipId')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('payslips:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resend a payslip by payslip ID' })
  @ApiParam({ name: 'payslipId', description: 'Payslip numeric ID' })
  @ApiResponse({ status: 200, description: 'Payslip resent (returns payslip)', type: PayslipDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async resendPayslip(@Param('payslipId') payslipId: string) {
    return this.payslipService.resendPayslip(+payslipId);
  }
}
