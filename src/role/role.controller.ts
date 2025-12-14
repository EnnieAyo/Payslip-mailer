import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards } from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @Permissions('roles:write')
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({ status: 201, description: 'Role created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Role already exists' })
  async create(@Body() createRoleDto: CreateRoleDto, @CurrentUser() user: any) {
    return await this.roleService.create(createRoleDto, user?.id);
  }

  @Get()
  @Permissions('roles:read')
  @ApiOperation({ summary: 'Get all roles' })
  @ApiResponse({ status: 200, description: 'Roles retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async findAll() {
    return await this.roleService.findAll();
  }

  @Get('permissions')
  @Permissions('roles:read')
  @ApiOperation({ summary: 'Get all available permissions' })
  @ApiResponse({ status: 200, description: 'Permissions retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async getPermissions() {
    return await this.roleService.getAvailablePermissions();
  }

  @Get(':name')
  @Permissions('roles:read')
  @ApiOperation({ summary: 'Get role by name' })
  @ApiParam({ name: 'name', description: 'Role name' })
  @ApiResponse({ status: 200, description: 'Role retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async findOne(@Param('name') name: string) {
    return await this.roleService.findOne(name);
  }

  @Put(':name')
  @Permissions('roles:write')
  @ApiOperation({ summary: 'Update role' })
  @ApiParam({ name: 'name', description: 'Role name' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 409, description: 'Cannot modify system roles' })
  async update(
    @Param('name') name: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @CurrentUser() user: any,
  ) {
    return await this.roleService.update(name, updateRoleDto, user?.id);
  }

  @Delete(':name')
  @Permissions('roles:write')
  @ApiOperation({ summary: 'Delete role' })
  @ApiParam({ name: 'name', description: 'Role name' })
  @ApiResponse({ status: 200, description: 'Role deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete system roles' })
  async delete(@Param('name') name: string, @CurrentUser() user: any) {
    return await this.roleService.delete(name, user?.id);
  }
}
