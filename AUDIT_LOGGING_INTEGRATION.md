# Audit Logging Integration Guide

## Overview

This guide explains the comprehensive audit logging system integrated into the Payslip-mailer application. It covers both the HTTP interceptor (global request/response logging) and service-level logging (business logic tracking).

## Table of Contents

1. [Architecture](#architecture)
2. [HTTP Interceptor (Global Logging)](#http-interceptor-global-logging)
3. [Service-Level Logging](#service-level-logging)
4. [Implementation Examples](#implementation-examples)
5. [Best Practices](#best-practices)
6. [Configuration & Customization](#configuration--customization)
7. [Troubleshooting](#troubleshooting)

---

## Architecture

### Two-Tier Logging Approach

The audit logging system uses two complementary layers:

```
┌─────────────────────────────────────┐
│     HTTP Request/Response           │
├─────────────────────────────────────┤
│  AuditLoggingInterceptor            │ ← Global HTTP logging
│  (src/common/interceptors/...)      │   • Captures all auditable endpoints
├─────────────────────────────────────┤   • Automatic request/response logging
│                                     │   • Client IP & user agent capture
│     NestJS Route Handler            │
├─────────────────────────────────────┤
│     Service Layer                   │ ← Business logic logging
│     (PayslipService, etc.)          │   • Granular action tracking
│     • Create/Update/Delete events   │   • Detailed context capture
│     • Status changes                │   • Error handling
│     • Business rule violations      │
├─────────────────────────────────────┤
│     AuditService.log()              │ ← Unified logging interface
├─────────────────────────────────────┤
│     PostgreSQL AuditLog Table       │ ← Immutable audit trail
└─────────────────────────────────────┘
```

### Why Two Layers?

| Layer | Purpose | Examples |
|-------|---------|----------|
| **HTTP Interceptor** | Capture all API traffic automatically | Who accessed what endpoint and when |
| **Service Layer** | Business-context specific logging | Employee created with IPPIS #123, Payslip matched to John Doe |

---

## HTTP Interceptor (Global Logging)

### Overview

The `AuditLoggingInterceptor` automatically logs all HTTP requests/responses for auditable endpoints.

**Location:** `src/common/interceptors/audit-logging.interceptor.ts`

### How It Works

1. **Intercepts** all HTTP requests before they reach route handlers
2. **Identifies** which endpoints are auditable using `AUDITABLE_ENDPOINTS` configuration
3. **Captures** request data (body, params, headers)
4. **Waits** for response (success or error)
5. **Logs** the complete transaction to audit database

### Auditable Endpoints Configuration

The interceptor is configured to automatically log specific endpoints:

```typescript
const AUDITABLE_ENDPOINTS: AuditableEndpoint[] = [
  {
    path: 'auth/register',              // Endpoint path
    action: 'USER_REGISTERED',          // What happened
    resource: 'user',                   // What entity was affected
    extractDetails: (body) => ({        // Custom detail extraction
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
    }),
  },
  // ... more endpoints
];
```

### Adding New Auditable Endpoints

To add a new endpoint to automatic logging, add an entry to `AUDITABLE_ENDPOINTS`:

```typescript
{
  path: 'your-resource/:id',
  action: 'YOUR_ACTION_NAME',
  resource: 'your-resource',
  extractResourceId: (body, params) => parseInt(params.id, 10),
  extractDetails: (body, params, response) => ({
    // Custom business context
    customField: body.someField,
    resultCount: response?.length || 0,
  }),
}
```

**Configuration Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `path` | string | ✓ | Route path pattern (supports `:param` syntax) |
| `action` | string | ✓ | Action type (UPPER_SNAKE_CASE) |
| `resource` | string | ✓ | Resource name affected |
| `extractResourceId` | function | ✗ | Extract primary resource ID from request |
| `extractDetails` | function | ✗ | Extract custom details from request/response |

### Automatic Logging Details

For each audited request, the interceptor logs:

```json
{
  "userId": 5,                    // From JWT token
  "action": "PAYSLIP_UPLOADED",
  "resource": "payslip",
  "resourceId": 42,              // Optional, from extractResourceId()
  "details": {
    "statusCode": 201,
    "method": "POST",
    "url": "/payslips/upload",
    "fileName": "payslips.pdf",
    "fileSize": 2048576,
    "uploadId": "upload-123456",
    "ippisCount": 15
  },
  "ipAddress": "192.168.1.100",   // Client IP (handles proxies)
  "userAgent": "Mozilla/5.0...",  // Browser info
  "status": "success",
  "errorMessage": null            // Only for failures
}
```

### Public vs Protected Endpoints

- **Public endpoints** (register, login, forgot-password): Logged without userId
- **Protected endpoints**: Logged with authenticated userId
- **Unauthenticated access to protected endpoints**: Skipped (rejected by guards anyway)

---

## Service-Level Logging

### Overview

Service-level logging captures granular business logic events with rich context.

### Currently Implemented Services

#### 1. PayslipService

**Method:** `resendPayslip(payslipId, userId)`

Logs both success and failure when resending payslips:

```typescript
await this.auditService.log({
  userId: 3,
  action: 'PAYSLIP_RESENT',
  resource: 'payslip',
  resourceId: 42,
  details: {
    employeeId: 10,
    employeeEmail: 'john@example.com',
    fileName: 'payslip-2024-01.pdf',
  },
  status: 'success',
});
```

#### 2. EmployeeService

**Methods:** `create()`, `update()`, `remove()`

Logs all employee lifecycle events:

**Create:**
```typescript
await auditService.log({
  userId: 3,
  action: 'EMPLOYEE_CREATED',
  resource: 'employee',
  resourceId: 10,
  details: {
    ippis: 'EMP001',
    name: 'John Doe',
    email: 'john@example.com',
  },
  status: 'success',
});
```

**Update:**
```typescript
await auditService.log({
  userId: 3,
  action: 'EMPLOYEE_UPDATED',
  resource: 'employee',
  resourceId: 10,
  details: {
    changes: {
      email: { from: 'old@example.com', to: 'new@example.com' },
      department: { from: 'IT', to: 'HR' },
    },
    fieldsModified: ['email', 'department'],
  },
  status: 'success',
});
```

**Delete:**
```typescript
await auditService.log({
  userId: 3,
  action: 'EMPLOYEE_DELETED',
  resource: 'employee',
  resourceId: 10,
  details: {
    name: 'John Doe',
    ippis: 'EMP001',
    email: 'john@example.com',
  },
  status: 'success',
});
```

---

## Implementation Examples

### Example 1: Adding Service-Level Logging to a New Service

Let's add audit logging to `EmailService`:

```typescript
import { Injectable } from '@nestjs/common';
import { AuditService } from '../auth/services/audit.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  constructor(private auditService: AuditService) {}

  async sendPayslip(
    to: string,
    pdfBuffer: Buffer,
    fileName: string,
    employeeName: string,
    userId?: number,
    employeeId?: number,
  ): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject: `Your Payslip - ${fileName}`,
        // ... email configuration
      });

      // Log successful email
      if (userId && employeeId) {
        await this.auditService.log({
          userId,
          action: 'EMAIL_SENT',
          resource: 'email',
          details: {
            recipient: to,
            employeeName,
            fileName,
            type: 'payslip',
          },
          status: 'success',
        });
      }

      return true;
    } catch (error) {
      // Log failed email
      if (userId && employeeId) {
        await this.auditService.log({
          userId,
          action: 'EMAIL_SENT',
          resource: 'email',
          details: {
            recipient: to,
            employeeName,
            fileName,
            type: 'payslip',
          },
          status: 'failure',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      console.error(`Error sending email to ${to}:`, error);
      return false;
    }
  }
}
```

### Example 2: Creating a New Service with Built-in Logging

```typescript
import { Injectable } from '@nestjs/common';
import { AuditService } from '../auth/services/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async generatePayslipReport(
    startDate: Date,
    endDate: Date,
    userId: number,
  ) {
    try {
      const payslips = await this.prisma.payslip.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: { employee: true },
      });

      // Build report
      const report = {
        totalCount: payslips.length,
        sentCount: payslips.filter((p) => p.emailSent).length,
        failureCount: payslips.filter((p) => !p.emailSent).length,
        data: payslips,
      };

      // Log report generation
      await this.auditService.log({
        userId,
        action: 'REPORT_GENERATED',
        resource: 'report',
        details: {
          reportType: 'payslip_summary',
          dateRange: { start: startDate, end: endDate },
          recordCount: payslips.length,
        },
        status: 'success',
      });

      return report;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.auditService.log({
        userId,
        action: 'REPORT_GENERATED',
        resource: 'report',
        details: {
          reportType: 'payslip_summary',
          dateRange: { start: startDate, end: endDate },
        },
        status: 'failure',
        errorMessage,
      });

      throw error;
    }
  }
}
```

### Example 3: Logging in Controllers

```typescript
import { Controller, Post, UseGuards, Req } from '@nestjs/common';
import { Request } from '@nestjs/common';
import { AuditService } from '../auth/services/audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('batch-operations')
@UseGuards(JwtAuthGuard)
export class BatchController {
  constructor(private auditService: AuditService) {}

  @Post('bulk-email')
  async sendBulkEmail(
    @Body() dto: BulkEmailDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    try {
      const results = await this.processBulkEmail(dto);

      // Log bulk operation
      await this.auditService.log({
        userId: user.id,
        action: 'BULK_EMAIL_SENT',
        resource: 'email',
        details: {
          recipientCount: dto.recipients.length,
          successCount: results.success,
          failureCount: results.failures,
          templateId: dto.templateId,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        status: 'success',
      });

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.auditService.log({
        userId: user.id,
        action: 'BULK_EMAIL_SENT',
        resource: 'email',
        details: {
          recipientCount: dto.recipients.length,
          templateId: dto.templateId,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        status: 'failure',
        errorMessage,
      });

      throw error;
    }
  }
}
```

---

## Best Practices

### 1. Always Include userId for Protected Operations

```typescript
// ✓ GOOD - captures who performed the action
if (userId) {
  await this.auditService.log({
    userId,  // Required for authentication context
    action: 'EMPLOYEE_CREATED',
    // ...
  });
}

// ✗ BAD - loses user context
await this.auditService.log({
  action: 'EMPLOYEE_CREATED',
  // ...
});
```

### 2. Log Both Success and Failure

```typescript
try {
  const result = await this.riskyOperation();

  await this.auditService.log({
    userId,
    action: 'OPERATION',
    resource: 'resource',
    status: 'success',
  });

  return result;
} catch (error) {
  await this.auditService.log({
    userId,
    action: 'OPERATION',
    resource: 'resource',
    status: 'failure',
    errorMessage: error instanceof Error ? error.message : 'Unknown error',
  });

  throw error;
}
```

### 3. Include Relevant Business Context

```typescript
// ✓ GOOD - includes business meaning
details: {
  employeeId: employee.id,
  employeeName: employee.name,
  emailRecipient: employee.email,
  processingTime: endTime - startTime,
}

// ✗ BAD - too technical
details: {
  stackTrace: '...',
  memoryUsed: 256000,
}
```

### 4. Use Consistent Action Names

Use UPPER_SNAKE_CASE format:
- `USER_CREATED`, `USER_UPDATED`, `USER_DELETED`
- `PAYSLIP_UPLOADED`, `PAYSLIP_SENT`, `PAYSLIP_RESENT`
- `EMPLOYEE_CREATED`, `EMPLOYEE_UPDATED`, `EMPLOYEE_DELETED`
- `EMAIL_SENT`, `EMAIL_FAILED`
- `REPORT_GENERATED`, `DATA_EXPORTED`

### 5. Use Optional Chaining for userId

```typescript
// Extract user ID safely
const userId = user?.id;

// Only log if available
if (userId) {
  await this.auditService.log({
    userId,
    // ...
  });
}
```

### 6. Graceful Error Handling in Logging

```typescript
// Never let logging failure break the business operation
try {
  // ... business logic ...

  try {
    await this.auditService.log({
      // ...
    });
  } catch (logError) {
    console.error('Failed to write audit log:', logError);
    // Don't throw - let business operation continue
  }

  return result;
} catch (businessError) {
  throw businessError;
}
```

---

## Configuration & Customization

### Global Interceptor Setup (main.ts)

The interceptor is registered globally in `src/main.ts`:

```typescript
import { AuditLoggingInterceptor } from './common/interceptors/audit-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Register global interceptor
  const authModuleRef = app.select(AuthModule);
  const auditService = authModuleRef.get('AuditService');
  app.useGlobalInterceptors(new AuditLoggingInterceptor(auditService));

  // ... rest of setup
}
```

### Module Dependencies

Each service module must import `AuthModule` to access `AuditService`:

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],  // ← Provides AuditService
  providers: [YourService],
  controllers: [YourController],
})
export class YourModule {}
```

### Customizing Path Matching

The interceptor supports parameterized routes:

```typescript
// Exact match
{ path: 'auth/login', /* ... */ }

// Parameterized match (matches auth/reset-password/123)
{ path: 'auth/reset-password/:id', /* ... */ }

// Multiple parameters (matches users/1/roles/admin)
{ path: 'users/:userId/roles/:roleId', /* ... */ }
```

---

## Troubleshooting

### Issue: Logs not appearing

**Diagnosis:**
1. Check if endpoint is in `AUDITABLE_ENDPOINTS` list
2. Verify `AuditService` is properly injected
3. Check database connection

**Solution:**
```typescript
// Temporarily add debug logging
console.log('About to log audit event:', {
  action: 'YOUR_ACTION',
  resource: 'your-resource',
});

await this.auditService.log({
  // ... your config
});

console.log('Audit event logged successfully');
```

### Issue: Circular dependency

**Error:** `Cannot resolve dependency`

**Solution:**
Move logging to a separate interceptor or use forwardRef():

```typescript
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [forwardRef(() => AuthModule)],
})
export class YourModule {}
```

### Issue: Performance impact

**Consideration:** Logging is async (`await this.auditService.log(...)`)

**Solution:** Non-critical logs can run without await:

```typescript
// Fire-and-forget for non-critical audit events
// (NOT recommended for security-critical operations)
this.auditService.log({ /* ... */ }).catch(err =>
  console.error('Audit log failed:', err),
);
```

### Issue: Sensitive data in logs

**Problem:** Passwords, tokens being logged

**Solution:** Never include sensitive data in details:

```typescript
// ✓ GOOD - no sensitive data
details: {
  email: user.email,
  role: user.role,
}

// ✗ BAD - includes password
details: {
  email: user.email,
  password: user.password,  // NEVER!
}
```

---

## Testing Audit Logging

### Unit Test Example

```typescript
describe('PayslipService Audit Logging', () => {
  let service: PayslipService;
  let auditService: AuditService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PayslipService,
        {
          provide: AuditService,
          useValue: { log: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(PayslipService);
    auditService = module.get(AuditService);
  });

  it('should log payslip resend success', async () => {
    const auditLogSpy = jest.spyOn(auditService, 'log');

    await service.resendPayslip(1, 5);

    expect(auditLogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 5,
        action: 'PAYSLIP_RESENT',
        status: 'success',
      }),
    );
  });
});
```

---

## Related Documentation

- [AUTHENTICATION_AUTHORIZATION.md](./AUTHENTICATION_AUTHORIZATION.md) - User authentication and permissions
- [AUDIT_LOGGING.md](./AUDIT_LOGGING.md) - Detailed audit logging API reference
- [NestJS Interceptors](https://docs.nestjs.com/interceptors)
- [NestJS Dependency Injection](https://docs.nestjs.com/providers/dependency-injection)
