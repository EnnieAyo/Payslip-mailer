import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { EmployeeDto } from './dto/employee.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

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
  create(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @CurrentUser() user: any,
  ) {
    return this.employeeService.create(createEmployeeDto, user?.id);
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
  findAll(@Query() pagination: PaginationDto) {
    const { page = 0, limit = 10 } = pagination || {};
    return this.employeeService.findAll(page, limit);
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
  findOne(@Param('id') id: string) {
    return this.employeeService.findOne(+id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('employees:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an existing employee' })
  @ApiResponse({ status: 200, type: EmployeeDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @CurrentUser() user: any,
  ) {
    return this.employeeService.update(+id, updateEmployeeDto, user?.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('employees:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an employee' })
  @ApiResponse({ status: 200, description: 'Employee deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.employeeService.remove(+id, user?.id);
  }
}
