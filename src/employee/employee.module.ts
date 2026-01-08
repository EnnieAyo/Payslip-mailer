import { Module } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { BullModule } from '@nestjs/bullmq';
import { REDIS_EMPLOYEE_QUEUE } from '@/constant';
import { EmployeeQueueConsumer } from './employeeQueue.consumer';

@Module({
  imports: [
    BullModule.registerQueue(
          {
          name: REDIS_EMPLOYEE_QUEUE
        }),
    PrismaModule,
    AuthModule],
  controllers: [EmployeeController],
  providers: [EmployeeService, EmployeeQueueConsumer],
  exports: [EmployeeService],
})
export class EmployeeModule {}
