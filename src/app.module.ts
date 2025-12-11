import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { PayslipModule } from './payslip/payslip.module';
import { EmployeeModule } from './employee/employee.module';
import { EmailModule } from './email/email.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    PrismaModule,
    PayslipModule,
    EmployeeModule,
    EmailModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // AuthModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
