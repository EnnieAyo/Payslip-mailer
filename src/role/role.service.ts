import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../auth/services/audit.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

export interface Role {
  name: string;
  description: string;
  permissions: string[];
}

@Injectable()
export class RoleService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(createRoleDto: CreateRoleDto, creatorId?: number) {
    // Check if role already exists
    const existingRole = await this.prisma.role.findUnique({
      where: { name: createRoleDto.name },
    });

    if (existingRole) {
      throw new ConflictException('Role with this name already exists');
    }

    const newRole = await this.prisma.role.create({
      data: {
        name: createRoleDto.name,
        description: createRoleDto.description || '',
        permissions: createRoleDto.permissions,
        isSystem: false,
        createdBy: creatorId,
      },
      select: {
        name: true,
        description: true,
        permissions: true,
      },
    });

    if (creatorId) {
      await this.auditService.log({
        userId: creatorId,
        action: 'ROLE_CREATED',
        resource: 'role',
        details: {
          name: newRole.name,
          permissions: newRole.permissions,
        },
        status: 'success',
      });
    }

    return newRole;
  }

  async findAll() {
    const roles = await this.prisma.role.findMany({
      select: {
        name: true,
        description: true,
        permissions: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      data: roles,
      total: roles.length,
    };
  }

  async findOne(name: string) {
    const role = await this.prisma.role.findFirst({
      where: { name, deletedAt: null },
      select: {
        name: true,
        description: true,
        permissions: true,
      },
    });

    if (!role) {
      throw new NotFoundException(`Role '${name}' not found`);
    }

    return role;
  }

  async update(name: string, updateRoleDto: UpdateRoleDto, updaterId?: number) {
    const role = await this.prisma.role.findFirst({
      where: { name, deletedAt: null },
    });

    if (!role) {
      throw new NotFoundException(`Role '${name}' not found`);
    }

    // Prevent modifying system roles
    if (role.isSystem) {
      throw new ConflictException('Cannot modify system roles');
    }

    const updatedRole = await this.prisma.role.update({
      where: { name },
      data: {
        ...updateRoleDto,
        updatedBy: updaterId,
      },
      select: {
        name: true,
        description: true,
        permissions: true,
      },
    });

    if (updaterId) {
      await this.auditService.log({
        userId: updaterId,
        action: 'ROLE_UPDATED',
        resource: 'role',
        details: {
          name,
          changes: Object.keys(updateRoleDto),
          oldPermissions: role.permissions,
          newPermissions: updatedRole.permissions,
        },
        status: 'success',
      });
    }

    return updatedRole;
  }

  async delete(name: string, deleterId?: number) {
    const role = await this.prisma.role.findFirst({
      where: { name, deletedAt: null },
    });

    if (!role) {
      throw new NotFoundException(`Role '${name}' not found`);
    }

    // Prevent deleting system roles
    if (role.isSystem) {
      throw new ConflictException('Cannot delete system roles');
    }

    await this.prisma.role.update({
      where: { name },
      data: { deletedAt: new Date() },
    });

    if (deleterId) {
      await this.auditService.log({
        userId: deleterId,
        action: 'ROLE_DELETED',
        resource: 'role',
        details: {
          name: role.name,
          permissions: role.permissions,
        },
        status: 'success',
      });
    }

    return { message: 'Role deleted successfully' };
  }

  /**
   * Restore a soft-deleted role
   */
  async restore(name: string, restorerId?: number) {
    const role = await this.prisma.role.findFirst({
      where: { name, deletedAt: { not: null } },
    });

    if (!role) {
      throw new NotFoundException(`Deleted role '${name}' not found`);
    }

    const restored = await this.prisma.restore('role', { name });

    if (restorerId) {
      await this.auditService.log({
        userId: restorerId,
        action: 'ROLE_RESTORED',
        resource: 'role',
        details: {
          name: role.name,
          permissions: role.permissions,
        },
        status: 'success',
      });
    }

    return restored;
  }

  /**
   * Get all soft-deleted roles
   */
  async findDeleted() {
    return this.prisma.findDeleted('role', {
      orderBy: { deletedAt: 'desc' },
    });
  }

  async getAvailablePermissions() {
    return {
      data: [
        { key: 'payslips:read', description: 'View payslips' },
        { key: 'payslips:write', description: 'Create, update, and delete payslips' },
        { key: 'employees:read', description: 'View employees' },
        { key: 'employees:write', description: 'Create, update, and delete employees' },
        { key: 'users:read', description: 'View users' },
        { key: 'users:write', description: 'Create, update, and delete users' },
        { key: 'audit:read', description: 'View audit logs' },
        { key: 'roles:read', description: 'View roles' },
        { key: 'roles:write', description: 'Create, update, and delete roles' },
      ],
    };
  }
}
