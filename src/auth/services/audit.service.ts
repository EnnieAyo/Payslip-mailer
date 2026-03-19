import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditLogInput {
  userId?: number;
  action: string;
  resource?: string;
  resourceId?: number;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status?: string;
  errorMessage?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  private logger = new Logger(AuditService.name);

  async findUserIdWhenUnknown(
    details: Record<string, any>,
  ): Promise<number | null> {
    if (details.userId) {
      return details.userId;
    }

    if (details.email) {
      const user = await this.prisma.user.findUnique({
        where: { email: details.email },
        select: { id: true },
      });
      return user ? user.id : null;
    }
    return null;
  }

  async log(input: AuditLogInput) {
    try{
      return this.prisma.auditLog.create({
        data: {
          userId: input.userId|| await this.findUserIdWhenUnknown(input.details || {}),
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId,
          details: input.details ? JSON.stringify(input.details) : undefined,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          status: input.status || 'success',
          errorMessage: input.errorMessage,
        },
      });
    } catch (error) {
      this.logger.error('Failed to log audit event:', error, { ...input, userId: input.userId || null });
      // Don't throw error to avoid affecting main flow
      return null;
    }
  }

  async getLogs(filters?: {
    userId?: number;
    action?: string;
    resource?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 50;
    const skip = (page-1>0)? (page-1) * limit : 0;

    const where: any = {
      userId: filters?.userId,
      action: filters?.action,
      resource: filters?.resource,
    };

    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  async getAuditTrail(resourceId: number, resource: string) {
    return this.prisma.auditLog.findMany({
      where: {
        resourceId,
        resource,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async getUserAuditTrail(userId: number,page= 0, limit = 50) {
    const take = limit;
    const skip = (page-1>0)? (page-1) * limit : 0;
const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where: { userId } }),
      this.prisma.auditLog.findMany({
        where: {
          userId
        },
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }
}
