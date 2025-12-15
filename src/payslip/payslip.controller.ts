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
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PayslipService } from './payslip.service';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiParam, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PayslipDto, PayslipUploadDto, UploadResultDto, UploadPayslipDto, BatchSendResultDto } from './dto/payslip.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
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
  @ApiOperation({ summary: 'Upload bulk payslips (PDF or ZIP) - processes but does not send emails' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        payMonth: { type: 'string', example: '2025-12', description: 'Pay month in YYYY-MM format' },
      },
      required: ['file', 'payMonth'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @ApiResponse({ status: 201, description: 'Upload processed (emails not sent yet)', type: UploadResultDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async uploadPayslips(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadPayslipDto,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const lower = file.originalname.toLowerCase();
    if (!lower.endsWith('.pdf') && !lower.endsWith('.zip')) {
      throw new BadRequestException('Only PDF or ZIP files are allowed');
    }

    if (!body.payMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.payMonth)) {
      throw new BadRequestException('payMonth is required and must be in YYYY-MM format (e.g., 2025-12)');
    }

    return this.payslipService.uploadAndProcess(
      file.buffer,
      file.originalname,
      body.payMonth,
      user?.id,
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
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiResponse({ status: 200, description: 'Payslips for employee' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async getPayslipsByEmployee(
    @Param('employeeId') employeeId: string,
    @Query() pagination: PaginationDto,
  ) {
    const { page = 0, limit = 10 } = pagination || {};
    return this.payslipService.getPayslipsByEmployee(+employeeId, page, limit);
  }

  @Get('unsent')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('payslips:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unsent payslips' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiResponse({ status: 200, description: 'Unsent payslips' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async getUnsentPayslips(@Query() pagination: PaginationDto) {
    const { page = 0, limit = 10 } = pagination || {};
    return this.payslipService.getUnsentPayslips(page, limit);
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
  async resendPayslip(
    @Param('payslipId') payslipId: string,
    @CurrentUser() user: any,
  ) {
    const result = await this.payslipService.resendPayslip(+payslipId, user?.id);
    return result;
  }

  // ==================== BATCH MANAGEMENT ENDPOINTS ====================

  @Get('batches')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('payslips:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all payslip upload batches' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'payMonth', required: false, type: String, description: 'Filter by pay month (YYYY-MM)' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status' })
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiResponse({ status: 200, description: 'List of batches', type: [PayslipUploadDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async getBatches(
    @Query() pagination: PaginationDto,
    @Query('payMonth') payMonth?: string,
    @Query('status') status?: string,
  ) {
    const { page = 1, limit = 10 } = pagination || {};
    return this.payslipService.getBatches(page, limit, payMonth, status);
  }

  @Get('batches/pending')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('payslips:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get batches ready to be sent (processed but not sent)' })
  @ApiResponse({ status: 200, description: 'List of pending batches', type: [PayslipUploadDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async getPendingBatches() {
    return this.payslipService.getPendingBatches();
  }

  @Get('batches/:batchId')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('payslips:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get batch details including all payslips' })
  @ApiParam({ name: 'batchId', description: 'Batch UUID or numeric ID' })
  @ApiResponse({ status: 200, description: 'Batch details with payslips', type: PayslipUploadDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  async getBatchDetails(@Param('batchId') batchId: string) {
    return this.payslipService.getBatchDetails(batchId);
  }

  @Post('batches/:batchId/send')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('payslips:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send all payslips in a batch via email' })
  @ApiParam({ name: 'batchId', description: 'Batch UUID or numeric ID' })
  @ApiResponse({ status: 200, description: 'Batch sending initiated/completed', type: BatchSendResultDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  @ApiResponse({ status: 400, description: 'Batch not in correct status' })
  async sendBatch(
    @Param('batchId') batchId: string,
    @CurrentUser() user: any,
  ) {
    return this.payslipService.sendBatch(batchId, user?.id);
  }
}
