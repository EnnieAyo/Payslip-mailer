import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Query, UsePipes, ValidationPipe, Patch, UseInterceptors, UploadedFile, Res, Header } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { EmployeeDto } from './dto/employee.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { BulkUploadResultDto } from './dto/bulk-upload.dto';

@ApiTags('Employees')
@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('employees:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new employee' })
  @ApiResponse({ status: 201, description: 'Employee created', type: EmployeeDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async create(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @CurrentUser() user: any,
  ) {
    return await this.employeeService.create(createEmployeeDto, user?.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('employees:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all employees' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiResponse({ status: 200, description: 'Employees retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async findAll(@Query() pagination: PaginationDto) {
    const { page = 0, limit = 10 } = pagination || {};
    return   await this.employeeService.findAll(page, limit);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('employees:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get employee by ID' })
  @ApiParam({ name: 'id', description: 'Employee numeric ID' })
  @ApiResponse({ status: 200, type: EmployeeDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async findOne(@Param('id') id: string) {
    return await this.employeeService.findOne(+id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('employees:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an existing employee' })
  @ApiResponse({ status: 200, type: EmployeeDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @CurrentUser() user: any,
  ) {
    return await this.employeeService.update(+id, updateEmployeeDto, user?.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('employees:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an employee' })
  @ApiResponse({ status: 200, description: 'Employee deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return await this.employeeService.remove(+id, user?.id);
  }

  @Patch(':id/restore')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('employees:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restore a soft-deleted employee' })
  @ApiResponse({ status: 200, description: 'Employee restored' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Deleted employee not found' })
  async restore(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return await this.employeeService.restore(+id, user?.id);
  }

  @Get('deleted/list')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('employees:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all soft-deleted employees' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Deleted employees retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async findDeleted(@Query() pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination || {};
    return await this.employeeService.findDeleted(page, limit);
  }

  @Get('bulk-upload/template')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('employees:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download Excel template for bulk employee upload' })
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename=employee-upload-template.xlsx')
  @ApiResponse({ status: 200, description: 'Excel template file' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async downloadTemplate(@Res() res: Response) {
    const buffer = this.employeeService.generateTemplate();
    res.send(buffer);
  }

  @Post('bulk-upload')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('employees:write')
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Bulk upload employees from Excel file' })
  @ApiBody({
    description: 'Excel file containing employee data',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Bulk upload completed',
    type: BulkUploadResultDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid file format or data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async bulkUpload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ): Promise<BulkUploadResultDto> {
    if (!file) {
      throw new Error('No file uploaded');
    }

    if (!file.originalname.match(/\.(xlsx|xls)$/)) {
      throw new Error('Only Excel files (.xlsx, .xls) are allowed');
    }

    return await this.employeeService.bulkUpload(file.buffer, user?.id);
  }
}
