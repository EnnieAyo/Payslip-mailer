import { Injectable } from '@nestjs/common';
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

  async log(input: AuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId,
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
  }

  async getLogs(filters?: {
    userId?: number;
    action?: string;
    resource?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    return this.prisma.auditLog.findMany({
      where: {
        userId: filters?.userId,
        action: filters?.action,
        resource: filters?.resource,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
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
}
