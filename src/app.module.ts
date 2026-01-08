import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { PayslipModule } from './payslip/payslip.module';
import { EmployeeModule } from './employee/employee.module';
import { EmailModule } from './email/email.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { UserModule } from './user/user.module';
import { RoleModule } from './role/role.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { AuditLoggingInterceptor } from './common/interceptors/audit-logging.interceptor';
import { ResponseWrapperInterceptor } from './common/interceptors/response-wrapper.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { BullModule } from '@nestjs/bullmq';
import { REDIS_APP_PREFIX, REDIS_EMPLOYEE_QUEUE, REDIS_PAYSILP_QUEUE } from './constant';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT|| '6379') ,
        username: process.env.REDIS_USERNAME || undefined,
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
      prefix: REDIS_APP_PREFIX,
      // extraOptions: {
      //   manualRegistration: true,
      // },
    }),
    // BullModule.registerQueue(
    //   {
    //   name: REDIS_PAYSILP_QUEUE
    // },
    //   {
    //   name: REDIS_EMPLOYEE_QUEUE,
    // }
    // ),
    PrismaModule,
    AuthModule,
    PayslipModule,
    EmployeeModule,
    EmailModule,
    AuditModule,
    UserModule,
    RoleModule,
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
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseWrapperInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
