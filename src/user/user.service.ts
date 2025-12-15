import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../auth/services/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(createUserDto: CreateUserDto, creatorId?: number) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
        createdBy: creatorId,
        permissions: [
          'payslips:read',
          'payslips:write',
          'employees:read',
          'employees:write',
          'audit:read',
        ],
        role: 'user',
      },
      select: {
        id: true,
        uuid: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        permissions: true,
        isActive: true,
        isLocked: true,
        emailVerified: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (creatorId) {
      await this.auditService.log({
        userId: creatorId,
        action: 'USER_CREATED',
        resource: 'user',
        resourceId: user.id,
        details: {
          email: user.email,
          role: user.role,
          permissions: user.permissions,
        },
        status: 'success',
      });
    }

    return user;
  }

  async findAll(page = 0, limit = 10, search?: string) {
    const take = limit;
    const skip = (page-1>0)? (page-1) * limit : 0;

    const where: any = {
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where: {...where, deletedAt: null},
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          uuid: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          permissions: true,
          isActive: true,
          isLocked: true,
          emailVerified: true,
          twoFactorEnabled: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take) || 0,
    };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id , deletedAt: null },
      select: {
        id: true,
        uuid: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        permissions: true,
        isActive: true,
        isLocked: true,
        emailVerified: true,
        emailVerifiedAt: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        failedLoginAttempts: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto, updaterId?: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Check if email is being changed and if it's already taken
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });

      if (existingUser) {
        throw new ConflictException('Email already in use');
      }
    }

    // Hash password if it's being updated
    const data: any = { ...updateUserDto };
    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...data,
        updatedBy: updaterId,
      },
      select: {
        id: true,
        uuid: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        permissions: true,
        isActive: true,
        isLocked: true,
        emailVerified: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (updaterId) {
      await this.auditService.log({
        userId: updaterId,
        action: 'USER_UPDATED',
        resource: 'user',
        resourceId: id,
        details: {
          changes: Object.keys(updateUserDto),
        },
        status: 'success',
      });
    }

    return updatedUser;
  }

  async delete(id: number, deleterId?: number) {
    const user = await this.prisma.user.findFirst({ 
      where: { id, deletedAt: null } 
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Prevent deleting yourself
    if (id === deleterId) {
      throw new BadRequestException('Cannot delete your own account');
    }

    await this.prisma.user.update({ 
      where: { id },
      data: { deletedAt: new Date() },
    });

    if (deleterId) {
      await this.auditService.log({
        userId: deleterId,
        action: 'USER_DELETED',
        resource: 'user',
        resourceId: id,
        details: {
          email: user.email,
          role: user.role,
        },
        status: 'success',
      });
    }

    return { message: 'User deleted successfully' };
  }

  async updatePermissions(id: number, permissions: string[], updaterId?: number) {
    const user = await this.prisma.user.findFirst({ 
      where: { id, deletedAt: null } 
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        permissions,
        updatedBy: updaterId,
      },
      select: {
        id: true,
        uuid: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        permissions: true,
        isActive: true,
        isLocked: true,
        emailVerified: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (updaterId) {
      await this.auditService.log({
        userId: updaterId,
        action: 'USER_PERMISSIONS_UPDATED',
        resource: 'user',
        resourceId: id,
        details: {
          email: user.email,
          oldPermissions: user.permissions,
          newPermissions: permissions,
        },
        status: 'success',
      });
    }

    return updatedUser;
  }

  async toggleActivation(id: number, updaterId?: number) {
    const user = await this.prisma.user.findFirst({ 
      where: { id, deletedAt: null } 
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Prevent deactivating yourself
    if (id === updaterId) {
      throw new BadRequestException('Cannot deactivate your own account');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: !user.isActive,
        updatedBy: updaterId,
      },
      select: {
        id: true,
        uuid: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        permissions: true,
        isActive: true,
        isLocked: true,
        emailVerified: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (updaterId) {
      await this.auditService.log({
        userId: updaterId,
        action: user.isActive ? 'USER_DEACTIVATED' : 'USER_ACTIVATED',
        resource: 'user',
        resourceId: id,
        details: {
          email: user.email,
          isActive: !user.isActive,
        },
        status: 'success',
      });
    }

    return updatedUser;
  }

  async unlockUser(id: number, unlockerId?: number) {
    const user = await this.prisma.user.findFirst({ 
      where: { id, deletedAt: null } 
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        isLocked: false,
        failedLoginAttempts: 0,
        updatedBy: unlockerId,
      },
      select: {
        id: true,
        uuid: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        permissions: true,
        isActive: true,
        isLocked: true,
        emailVerified: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (unlockerId) {
      await this.auditService.log({
        userId: unlockerId,
        action: 'USER_UNLOCKED',
        resource: 'user',
        resourceId: id,
        details: {
          email: user.email,
        },
        status: 'success',
      });
    }

    return updatedUser;
  }

  /**
   * Restore a soft-deleted user
   */
  async restore(id: number, restorerId?: number) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: { not: null } },
    });

    if (!user) {
      throw new NotFoundException(`Deleted user with ID ${id} not found`);
    }

    const restored = await this.prisma.restore('user', { id });

    if (restorerId) {
      await this.auditService.log({
        userId: restorerId,
        action: 'USER_RESTORED',
        resource: 'user',
        resourceId: id,
        details: {
          email: user.email,
          role: user.role,
        },
        status: 'success',
      });
    }

    return restored;
  }

  /**
   * Get all soft-deleted users
   */
  async findDeleted(page = 1, limit = 10) {
    const take = limit;
    const skip = (page - 1 > 0) ? (page - 1) * limit : 0;

    const [data, total] = await Promise.all([
      this.prisma.findDeleted('user', {
        take,
        skip,
        orderBy: { deletedAt: 'desc' },
      }),
      this.prisma.user.count({ where: { deletedAt: { not: null } } }),
    ]);

    return {
      data,
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take) || 0,
    };
  }
}
