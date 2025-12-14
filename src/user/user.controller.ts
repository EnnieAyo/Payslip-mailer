import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Query, Patch } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Permissions('users:write')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async create(@Body() createUserDto: CreateUserDto, @CurrentUser() user: any) {
    return await this.userService.create(createUserDto, user?.id);
  }

  @Get()
  @Permissions('users:read')
  @ApiOperation({ summary: 'Get all users' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Users retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async findAll(@Query() pagination: PaginationDto, @Query('search') search?: string) {
    const { page = 0, limit = 10 } = pagination || {};
    return await this.userService.findAll(page, +limit, search);
  }

  @Get(':id')
  @Permissions('users:read')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User numeric ID' })
  @ApiResponse({ status: 200, description: 'User retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string) {
    return await this.userService.findOne(+id);
  }

  @Put(':id')
  @Permissions('users:write')
  @ApiOperation({ summary: 'Update user' })
  @ApiParam({ name: 'id', description: 'User numeric ID' })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: any,
  ) {
    return await this.userService.update(+id, updateUserDto, user?.id);
  }

  @Delete(':id')
  @Permissions('users:write')
  @ApiOperation({ summary: 'Delete user' })
  @ApiParam({ name: 'id', description: 'User numeric ID' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    return await this.userService.delete(+id, user?.id);
  }

  @Patch(':id/permissions')
  @Permissions('users:write')
  @ApiOperation({ summary: 'Update user permissions' })
  @ApiParam({ name: 'id', description: 'User numeric ID' })
  @ApiResponse({ status: 200, description: 'Permissions updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updatePermissions(
    @Param('id') id: string,
    @Body('permissions') permissions: string[],
    @CurrentUser() user: any,
  ) {
    return await this.userService.updatePermissions(+id, permissions, user?.id);
  }

  @Patch(':id/toggle-activation')
  @Permissions('users:write')
  @ApiOperation({ summary: 'Toggle user active status' })
  @ApiParam({ name: 'id', description: 'User numeric ID' })
  @ApiResponse({ status: 200, description: 'User activation toggled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async toggleActivation(@Param('id') id: string, @CurrentUser() user: any) {
    return await this.userService.toggleActivation(+id, user?.id);
  }

  @Patch(':id/unlock')
  @Permissions('users:write')
  @ApiOperation({ summary: 'Unlock user account' })
  @ApiParam({ name: 'id', description: 'User numeric ID' })
  @ApiResponse({ status: 200, description: 'User unlocked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async unlockUser(@Param('id') id: string, @CurrentUser() user: any) {
    return await this.userService.unlockUser(+id, user?.id);
  }

  @Patch(':id/restore')
  @Permissions('users:write')
  @ApiOperation({ summary: 'Restore a soft-deleted user' })
  @ApiParam({ name: 'id', description: 'User numeric ID' })
  @ApiResponse({ status: 200, description: 'User restored' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Deleted user not found' })
  async restore(@Param('id') id: string, @CurrentUser() user: any) {
    return await this.userService.restore(+id, user?.id);
  }

  @Get('deleted/list')
  @Permissions('users:read')
  @ApiOperation({ summary: 'Get all soft-deleted users' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Deleted users retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async findDeleted(@Query() pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination || {};
    return await this.userService.findDeleted(page, limit);
  }
}
