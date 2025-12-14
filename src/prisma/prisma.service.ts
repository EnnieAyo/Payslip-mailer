import { Injectable, OnModuleInit } from '@nestjs/common';
// import { PrismaClient } from '@prisma/client';
import { PrismaClient } from '@generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    super({
      adapter,
      log: ['info', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Hard delete - permanently removes record from database
   * Use with caution!
   */
  async hardDelete(model: string, where: any) {
    return (this as any)[model].delete({ where });
  }

  /**
   * Restore soft-deleted record
   */
  async restore(model: string, where: any) {
    return (this as any)[model].updateMany({
      where: { ...where, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
  }

  /**
   * Find soft-deleted records only
   */
  async findDeleted(model: string, args?: any) {
    return (this as any)[model].findMany({
      ...args,
      where: { ...args?.where, deletedAt: { not: null } },
    });
  }
}
