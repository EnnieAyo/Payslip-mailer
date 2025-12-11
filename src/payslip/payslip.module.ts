import { Module } from '@nestjs/common';
import { PayslipService } from './payslip.service';
import { PayslipController } from './payslip.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { PdfModule } from '../pdf/pdf.module';
import { EmployeeModule } from '../employee/employee.module';

@Module({
  imports: [PrismaModule, EmailModule, PdfModule, EmployeeModule],
  controllers: [PayslipController],
  providers: [PayslipService],
})
export class PayslipModule {}
