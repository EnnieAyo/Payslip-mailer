# Audit Logging Guide

## Overview

The Payslip-mailer application includes a comprehensive audit logging system that tracks all user actions and system events. This guide provides detailed information about audit logging capabilities, implementation patterns, and best practices.

## Table of Contents

1. [Audit System Architecture](#audit-system-architecture)
2. [AuditService API](#auditservice-api)
3. [Logging Best Practices](#logging-best-practices)
4. [Integration Examples](#integration-examples)
5. [Querying Audit Logs](#querying-audit-logs)
6. [Compliance & Retention](#compliance--retention)

---

## Audit System Architecture

### Components

```
AuditService (src/auth/services/audit.service.ts)
    ↓
PrismaService (Database ORM)
    ↓
AuditLog Table (PostgreSQL)
    ↓
AuditController (src/audit/audit.controller.ts)
    ↓
REST API Endpoints
```

### AuditLog Table Schema

```typescript
model AuditLog {
  id           Int      @id @default(autoincrement())
  userId       Int?     // User performing the action (nullable for system events)
  user         User?    @relation(fields: [userId], references: [id])
  action       String   // What happened (e.g., 'USER_CREATED', 'LOGIN')
  resource     String?  // What was affected (e.g., 'user', 'payslip', 'employee')
  resourceId   Int?     // ID of the affected resource
  details      String?  // Additional context (JSON string)
  ipAddress    String?  // Client IP address
  userAgent    String?  // Client user agent string
  status       String   @default("success")  // 'success' or 'failure'
  errorMessage String?  // Error details if status is 'failure'
  createdAt    DateTime @default(now())  // When the action occurred
}
```

### Key Features

- **Non-Repudiation**: Records who did what and when (userId + timestamp)
- **Comprehensive Tracking**: Captures action, resource, client info, and details
- **Error Tracking**: Records failures with error messages for debugging
- **Queryable**: Supports filtering by user, action, resource, and date range
- **Immutable**: Audit logs cannot be modified once created
- **JSON Details**: Flexible details field for storing additional context

---

## AuditService API

### Service Methods

#### log(input: AuditLogInput): Promise<AuditLog>

Creates a new audit log entry.

**Parameters:**
```typescript
interface AuditLogInput {
  userId?: number;              // ID of user performing action
  action: string;               // REQUIRED: Action type
  resource?: string;            // Resource being affected
  resourceId?: number;          // ID of affected resource
  details?: Record<string, any>; // Additional context (auto JSON-stringified)
  ipAddress?: string;           // Client IP
  userAgent?: string;           // Browser user agent
  status?: string;              // 'success' (default) or 'failure'
  errorMessage?: string;        // Error details if failed
}
```

**Returns:** The created AuditLog record

**Example:**
```typescript
await this.auditService.log({
  userId: user.id,
  action: 'PAYSLIP_UPLOADED',
  resource: 'payslip',
  resourceId: uploadId,
  details: {
    fileName: 'payslip-2024-01.pdf',
    ippisCount: 15,
    fileSize: 2048576
  },
  status: 'success'
});
```

#### getLogs(filters): Promise<AuditLog[]>

Retrieves audit logs with filtering and pagination.

**Parameters:**
```typescript
interface LogFilters {
  userId?: number;     // Filter by user
  action?: string;     // Filter by action type
  resource?: string;   // Filter by resource type
  limit?: number;      // Number of records (default: 50)
  offset?: number;     // Pagination offset (default: 0)
}
```

**Returns:** Array of AuditLog records with user information included

**Example:**
```typescript
const logs = await this.auditService.getLogs({
  userId: 5,
  action: 'LOGIN',
  limit: 100,
  offset: 0
});
```

#### getAuditTrail(resourceId: number, resource: string): Promise<AuditLog[]>

Gets complete audit trail for a specific resource (all changes to that resource).

**Parameters:**
- `resourceId`: ID of the resource
- `resource`: Type of resource (e.g., 'payslip', 'user', 'employee')

**Returns:** Array of AuditLog records related to that resource, ordered by creation time (newest first)

**Example:**
```typescript
// Get all changes to payslip #123
const trail = await this.auditService.getAuditTrail(123, 'payslip');

// Shows: when it was created, who modified it, when it was emailed, etc.
```

---

## Logging Best Practices

### 1. Always Include Required Information

```typescript
// ✓ GOOD
await this.auditService.log({
  userId: currentUser.id,      // Who
  action: 'EMPLOYEE_UPDATED',  // What
  resource: 'employee',        // Where
  resourceId: employee.id,     // Which one
  status: 'success'            // Result
});

// ✗ BAD
await this.auditService.log({
  action: 'UPDATE'  // Too vague, missing details
});
```

### 2. Use Consistent Action Naming

Use UPPER_SNAKE_CASE for action names:
- `USER_CREATED`, not `user_created` or `UserCreated`
- `PAYSLIP_UPLOADED`, not `payslip_upload` or `PayslipUpload`
- Include the verb: `CREATED`, `UPDATED`, `DELETED`, `EMAILED`

### 3. Include Relevant Details

Store business-meaningful context in details:

```typescript
// ✓ GOOD - includes meaningful business data
await this.auditService.log({
  userId: user.id,
  action: 'PAYSLIP_SENT',
  resource: 'payslip',
  resourceId: payslip.id,
  details: {
    employeeId: payslip.employeeId,
    employeeName: payslip.employee.name,
    emailRecipient: payslip.employee.email,
    sentAt: new Date().toISOString()
  },
  status: 'success'
});

// ✗ BAD - details are too technical or unhelpful
await this.auditService.log({
  userId: user.id,
  action: 'PAYSLIP_SENT',
  resource: 'payslip',
  resourceId: payslip.id,
  details: {
    stackTrace: '...',        // Don't store stack traces
    memoryUsed: 256000000     // Not relevant to business
  }
});
```

### 4. Track Both Success and Failure

Log both successful and failed operations:

```typescript
try {
  const result = await this.processPayslip(file);
  
  await this.auditService.log({
    userId: user.id,
    action: 'PAYSLIP_PROCESSED',
    resource: 'payslip',
    resourceId: result.id,
    details: {
      fileName: file.originalname,
      ippisExtracted: result.ippis,
      duration: result.processingTime
    },
    status: 'success'
  });
} catch (error) {
  await this.auditService.log({
    userId: user.id,
    action: 'PAYSLIP_PROCESSED',
    resource: 'payslip',
    details: {
      fileName: file.originalname,
      errorType: error.name
    },
    status: 'failure',
    errorMessage: error.message
  });
  throw error;
}
```

### 5. Capture Client Information

Include IP address and user agent when available:

```typescript
import { Request } from '@nestjs/common';

@Post('upload')
async uploadPayslip(
  @Req() req: Request,
  @Body() body: UploadDto,
  @CurrentUser() user: any
) {
  const ipAddress = req.ip || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];
  
  // ... process upload ...
  
  await this.auditService.log({
    userId: user.id,
    action: 'PAYSLIP_UPLOADED',
    resource: 'payslip',
    resourceId: payslip.id,
    ipAddress,
    userAgent,
    details: { /* ... */ },
    status: 'success'
  });
}
```

### 6. Log Sensitive Actions Immediately

Critical actions should be logged synchronously:

```typescript
// Immediate logging for security-critical operations
await this.auditService.log({
  userId: user.id,
  action: 'PASSWORD_RESET',
  resource: 'user',
  resourceId: targetUser.id,
  status: 'success'
});

// Then perform the actual action
await this.resetPassword(targetUser.id, newPassword);
```

### 7. Use Resource Trail for Entity History

Access complete history of changes to any resource:

```typescript
// Example: Getting all changes to a payslip
const history = await this.auditService.getAuditTrail(payslipId, 'payslip');

/*
Returns:
[
  { action: 'PAYSLIP_EMAILED', createdAt: '2024-01-15T14:30:00Z', ... },
  { action: 'PAYSLIP_PROCESSED', createdAt: '2024-01-15T14:25:00Z', ... },
  { action: 'PAYSLIP_UPLOADED', createdAt: '2024-01-15T14:20:00Z', ... },
]
*/
```

---

## Integration Examples

### Example 1: Logging in a Service

```typescript
import { Injectable } from '@nestjs/common';
import { AuditService } from '../auth/services/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PayslipService {
  constructor(
    private auditService: AuditService,
    private prisma: PrismaService
  ) {}

  async uploadAndProcessPayslip(
    file: Express.Multer.File,
    userId: number,
    ipAddress: string,
    userAgent: string
  ) {
    const uploadId = `upload-${Date.now()}`;
    
    try {
      // Process the file
      const result = await this.processFile(file);
      
      // Log successful upload
      await this.auditService.log({
        userId,
        action: 'PAYSLIP_UPLOADED',
        resource: 'payslip',
        resourceId: result.id,
        details: {
          fileName: file.originalname,
          fileSize: file.size,
          ippisCount: result.ippis.length,
          processingTime: result.duration,
          uploadId
        },
        ipAddress,
        userAgent,
        status: 'success'
      });
      
      return result;
    } catch (error) {
      // Log failed upload
      await this.auditService.log({
        userId,
        action: 'PAYSLIP_UPLOADED',
        details: {
          fileName: file.originalname,
          fileSize: file.size,
          uploadId,
          errorType: error.name
        },
        ipAddress,
        userAgent,
        status: 'failure',
        errorMessage: error.message
      });
      
      throw error;
    }
  }
}
```

### Example 2: Logging in a Controller

```typescript
import { Controller, Post, UseGuards, Req, Body } from '@nestjs/common';
import { Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../auth/services/audit.service';

@Controller('employees')
@UseGuards(JwtAuthGuard)
export class EmployeeController {
  constructor(
    private employeeService: EmployeeService,
    private auditService: AuditService
  ) {}

  @Post()
  async createEmployee(
    @Body() createDto: CreateEmployeeDto,
    @CurrentUser() user: any,
    @Req() req: Request
  ) {
    const employee = await this.employeeService.create(createDto);
    
    // Log the employee creation
    await this.auditService.log({
      userId: user.id,
      action: 'EMPLOYEE_CREATED',
      resource: 'employee',
      resourceId: employee.id,
      details: {
        ippis: employee.ippis,
        name: employee.name,
        email: employee.email,
        department: employee.department
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      status: 'success'
    });
    
    return employee;
  }
}
```

### Example 3: Audit Trail in Service

```typescript
// In EmployeeService
async updateEmployee(id: number, updateDto: UpdateEmployeeDto) {
  const oldEmployee = await this.prisma.employee.findUnique({
    where: { id }
  });
  
  const newEmployee = await this.prisma.employee.update({
    where: { id },
    data: updateDto
  });
  
  // Log what changed
  const changes = this.detectChanges(oldEmployee, newEmployee);
  
  await this.auditService.log({
    userId: currentUser.id,
    action: 'EMPLOYEE_UPDATED',
    resource: 'employee',
    resourceId: id,
    details: {
      changes, // { name: { from: 'John', to: 'Jane' }, ... }
      fieldsModified: Object.keys(changes)
    },
    status: 'success'
  });
}

private detectChanges(old: any, new: any): Record<string, any> {
  const changes: Record<string, any> = {};
  
  for (const key of Object.keys(new)) {
    if (old[key] !== new[key]) {
      changes[key] = { from: old[key], to: new[key] };
    }
  }
  
  return changes;
}
```

---

## Querying Audit Logs

### REST API

#### Get All Logs

```bash
GET /audit/logs
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "userId": 3,
    "action": "PAYSLIP_UPLOADED",
    "resource": "payslip",
    "resourceId": 42,
    "details": "{\"fileName\": \"payslip.pdf\", \"fileSize\": 2048}",
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "status": "success",
    "errorMessage": null,
    "createdAt": "2024-01-15T10:30:00Z",
    "user": {
      "id": 3,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
]
```

#### Filter by User

```bash
GET /audit/logs?userId=3
Authorization: Bearer <token>
```

Returns all actions by user ID 3.

#### Filter by Action

```bash
GET /audit/logs?action=LOGIN
Authorization: Bearer <token>
```

Returns all login events.

#### Filter by Resource Type

```bash
GET /audit/logs?resource=payslip
Authorization: Bearer <token>
```

Returns all payslip-related actions.

#### Pagination

```bash
GET /audit/logs?limit=20&offset=40
Authorization: Bearer <token>
```

Returns records 40-60 (useful for large result sets).

#### Combined Filters

```bash
GET /audit/logs?userId=3&action=PAYSLIP_UPLOADED&limit=10
Authorization: Bearer <token>
```

#### Get Audit Trail for Resource

```bash
GET /audit/trail/42/payslip
Authorization: Bearer <token>
```

Returns complete history of all changes to payslip #42.

**Response:**
```json
[
  {
    "id": 15,
    "action": "PAYSLIP_EMAILED",
    "createdAt": "2024-01-15T14:35:00Z",
    "userId": 3,
    "user": { "firstName": "John", "lastName": "Doe", ... },
    "details": "{\"sentTo\": \"employee@example.com\", \"status\": \"delivered\"}"
  },
  {
    "id": 14,
    "action": "PAYSLIP_PROCESSED",
    "createdAt": "2024-01-15T14:25:00Z",
    "userId": 3,
    "details": "{\"ippis\": \"EMP001\", \"processingTime\": 245}"
  },
  {
    "id": 13,
    "action": "PAYSLIP_UPLOADED",
    "createdAt": "2024-01-15T14:20:00Z",
    "userId": 3,
    "details": "{\"fileName\": \"payslip.pdf\", \"fileSize\": 2048}"
  }
]
```

### Database Queries (Prisma)

```typescript
// Get last 100 audit logs
const logs = await this.prisma.auditLog.findMany({
  take: 100,
  orderBy: { createdAt: 'desc' },
  include: { user: true }
});

// Get logs for specific user
const userLogs = await this.prisma.auditLog.findMany({
  where: { userId: 3 },
  orderBy: { createdAt: 'desc' }
});

// Get failed operations
const failures = await this.prisma.auditLog.findMany({
  where: { status: 'failure' },
  orderBy: { createdAt: 'desc' }
});

// Get logs from last 24 hours
const recent = await this.prisma.auditLog.findMany({
  where: {
    createdAt: {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
    }
  },
  orderBy: { createdAt: 'desc' }
});

// Get all logins for a user in last 7 days
const logins = await this.prisma.auditLog.findMany({
  where: {
    userId: 3,
    action: 'LOGIN',
    createdAt: {
      gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }
  },
  orderBy: { createdAt: 'desc' }
});

// Count failures by action type
const failureStats = await this.prisma.auditLog.groupBy({
  by: ['action'],
  where: { status: 'failure' },
  _count: true
});
```

---

## Compliance & Retention

### Data Retention Policy

Consider implementing a retention policy for audit logs:

```typescript
// Archive or delete logs older than 1 year
async archiveOldLogs() {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  const archived = await this.prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: oneYearAgo }
    }
  });
  
  console.log(`Archived ${archived.count} logs`);
}
```

### GDPR Compliance

When deleting a user, consider:
1. Anonymizing their audit logs (remove identifying details)
2. Keeping aggregate data (counts, statistics)
3. Retaining logs for compliance period

```typescript
// Anonymize user logs while keeping audit trail
async anonymizeUserLogs(userId: number) {
  await this.prisma.auditLog.updateMany({
    where: { userId },
    data: {
      userId: null,
      details: '[Anonymized]'
    }
  });
}
```

### Audit Log Integrity

To ensure logs cannot be tampered with:
1. Use read-only database user for audit logs
2. Enable PostgreSQL audit logging
3. Store backups separately
4. Regularly verify log consistency

---

## Monitoring & Alerting

### Key Metrics to Monitor

1. **Failed Login Attempts**
   ```bash
   GET /audit/logs?action=LOGIN_FAILED&limit=1000
   ```

2. **Permission Denied Events**
   ```bash
   GET /audit/logs?action=PERMISSION_DENIED&limit=1000
   ```

3. **Admin Actions**
   ```bash
   GET /audit/logs?action=USER_CREATED&action=USER_DELETED
   ```

4. **System Errors**
   ```bash
   GET /audit/logs?status=failure
   ```

### Alert Conditions

Consider alerting on:
- More than 3 failed logins from same IP in 5 minutes
- Permission denied errors for service accounts
- Mass deletion operations (many DELETED actions in short time)
- After-hours administrative access
- Failed payslip processing (high error rate)

---

## Testing Audit Logs

```typescript
describe('AuditService', () => {
  it('should log successful action', async () => {
    const result = await auditService.log({
      userId: 1,
      action: 'TEST_ACTION',
      resource: 'test',
      resourceId: 1,
      status: 'success'
    });
    
    expect(result.id).toBeDefined();
    expect(result.action).toBe('TEST_ACTION');
    expect(result.status).toBe('success');
  });
  
  it('should retrieve logs with filters', async () => {
    const logs = await auditService.getLogs({
      userId: 1,
      limit: 10
    });
    
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.every(l => l.userId === 1)).toBe(true);
  });
  
  it('should return audit trail for resource', async () => {
    const trail = await auditService.getAuditTrail(1, 'test');
    
    expect(Array.isArray(trail)).toBe(true);
    expect(trail.every(l => l.resourceId === 1)).toBe(true);
  });
});
```

---

## Related Resources

- [NIST Guide to Computer Security Log Management](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-92.pdf)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [Prisma Documentation on Querying](https://www.prisma.io/docs/concepts/components/prisma-client/crud)
