import { Module } from '@nestjs/common';
import { PayslipService } from './payslip.service';
import { PayslipController } from './payslip.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { PdfModule } from '../pdf/pdf.module';
import { EmployeeModule } from '../employee/employee.module';
import { AuthModule } from '../auth/auth.module';
import { REDIS_PAYSILP_QUEUE } from '@/constant';
import { BullModule } from '@nestjs/bullmq';
import { PayslipQueueConsumer } from './payslipQueue.consumer';

@Module({
  imports: [
    BullModule.registerQueue(
      {
      name: REDIS_PAYSILP_QUEUE
    }),
    PrismaModule,
    EmailModule,
    PdfModule,
    EmployeeModule,
    AuthModule],
  controllers: [PayslipController],
  providers: [PayslipService, PayslipQueueConsumer],
})
export class PayslipModule {}
