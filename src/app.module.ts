import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { PayslipModule } from './payslip/payslip.module';
import { EmployeeModule } from './employee/employee.module';
import { EmailModule } from './email/email.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [PrismaModule, PayslipModule, EmployeeModule, EmailModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
