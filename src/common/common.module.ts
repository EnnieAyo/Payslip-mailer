import { Module } from '@nestjs/common';
import { AuditLoggingInterceptor } from './interceptors/audit-logging.interceptor';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [AuditLoggingInterceptor],
  exports: [AuditLoggingInterceptor],
})
export class CommonModule {}
