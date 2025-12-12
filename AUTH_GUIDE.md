# Authentication & Authorization Guide

## Overview

The Payslip Mailer API implements JWT-based authentication with Role-Based Access Control (RBAC) and permission-based authorization.

### Key Features
- **JWT Tokens**: Stateless authentication using signed JWT tokens (24-hour expiry)
- **Role-Based Access**: Three default roles: `user`, `payroll_manager`, `admin`
- **Permission-Based Authorization**: Fine-grained permissions (e.g., `payslips:read`, `payslips:write`)
- **Password Hashing**: Bcrypt for secure password storage
- **Account Lockout**: Automatic account lockout after 5 failed login attempts
- **Last Login Tracking**: Records the timestamp of each successful login
- **Audit Columns**: All database tables track who created/updated records (`createdBy`, `updatedBy`)
- **Swagger Integration**: Built-in Bearer token support in Swagger UI

## Default Users

After seeding the database, two test users are available:

```
Admin User:
  Email: admin@company.com
  Password: admin123456
  Role: admin
  Permissions: All

Payroll Manager:
  Email: manager@company.com
  Password: manager123456
  Role: payroll_manager
  Permissions: payslips:read, payslips:write, employees:read
```

## API Endpoints

### Authentication

#### POST `/auth/register`
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user"
  }
}
```

#### POST `/auth/login`
Login and get JWT token.

**Request:**
```json
{
  "email": "admin@company.com",
  "password": "admin123456"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@company.com",
    "firstName": "Admin",
    "lastName": "User",
    "role": "admin"
  }
}
```

### Protected Endpoints

All `/payslips` and `/employees` endpoints now require:
1. **Valid JWT Token** in the Authorization header
2. **Required Permissions** based on the operation

#### Example: Upload Payslips
```bash
curl -X POST "http://localhost:3000/payslips/upload" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "file=@payslips.pdf"
```

#### Example: Get Employees
```bash
curl -X GET "http://localhost:3000/employees" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Permission Model

Permissions follow the pattern: `resource:action`

### Available Permissions

#### Payslip Permissions
- `payslips:read` - View payslips and upload status
- `payslips:write` - Upload payslips and resend

#### Employee Permissions
- `employees:read` - View employee data
- `employees:write` - Create, update, delete employees

#### User Permissions
- `users:read` - View user data
- `users:write` - Manage users

## Account Security

### Account Lockout (5 Failed Login Attempts)

After **5 consecutive failed login attempts**, a user account is automatically locked to prevent brute-force attacks.

**What happens:**
1. First failed attempt: `failedLoginAttempts` increments
2. After 5 failed attempts: `isLocked` = true, error returned
3. On successful login: `failedLoginAttempts` resets to 0, `lastLoginAt` updated

**Error on Locked Account:**
```
"Account is locked due to too many failed login attempts. Please contact an administrator."
```

### Last Login Tracking

Every successful login updates `lastLoginAt` with the current timestamp. Use this to:
- Monitor user activity
- Detect inactive accounts
- Identify suspicious access patterns

Query example:
```bash
# Get users with login history
curl -X GET "http://localhost:3000/api" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Unlocking User Accounts (Admin Only)

#### POST `/auth/unlock`

Reset a locked user account. Requires `users:write` permission.

```bash
curl -X POST "http://localhost:3000/auth/unlock" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": 3}'
```

**Request:**
```json
{
  "userId": 3
}
```

**Response:**
```json
{
  "message": "User account unlocked successfully",
  "user": {
    "id": 3,
    "email": "user@example.com",
    "isLocked": false
  }
}
```

### Resetting User Passwords (Admin Only)

#### POST `/auth/reset-password`

Admin can reset a user's password. Also unlocks the account and resets failed login counter.

```bash
curl -X POST "http://localhost:3000/auth/reset-password" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": 3, "newPassword": "newSecurePassword123"}'
```

**Request:**
```json
{
  "userId": 3,
  "newPassword": "newSecurePassword123"
}
```

**Response:**
```json
{
  "message": "Password reset successfully",
  "user": {
    "id": 3,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

## Audit Columns

All tables include audit tracking fields:

- `createdBy` (Int, nullable): User ID who created the record
- `updatedBy` (Int, nullable): User ID who last updated the record
- `createdAt` (DateTime): When created
- `updatedAt` (DateTime): When last modified

**Tables with audit columns:**
- `users`
- `employees`
- `payslips`
- `payslip_uploads`

### Recording Audit Data in Code

When creating/updating records, populate the audit fields:

```typescript
// Creating with audit trail
await this.prisma.employee.create({
  data: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    ippisNumber: 'IPPIS001',
    createdBy: currentUserId, // Track creator
  },
});

// Updating with audit trail
await this.prisma.employee.update({
  where: { id: employeeId },
  data: {
    firstName: 'Jane',
    updatedBy: currentUserId, // Track who modified
  },
});
```

### Querying Audit Data

```sql
-- Find all records created by a specific user
SELECT * FROM employees WHERE createdBy = 1;

-- Find recent changes
SELECT 
  id, firstName, lastName, 
  updatedAt,
  updatedBy
FROM employees
WHERE updatedAt > NOW() - INTERVAL '7 days'
ORDER BY updatedAt DESC;

-- Audit trail with user details
SELECT 
  e.id, 
  e.firstName, 
  u1.email as createdBy,
  e.createdAt,
  u2.email as lastModifiedBy,
  e.updatedAt
FROM employees e
LEFT JOIN users u1 ON e.createdBy = u1.id
LEFT JOIN users u2 ON e.updatedBy = u2.id
ORDER BY e.updatedAt DESC;
```

## Using Swagger UI

1. Start the dev server: `npm run start:dev`
2. Open Swagger UI: `http://localhost:3000/api`
3. Click the "Authorize" button in the top-right
4. Paste the JWT token in the format: `Bearer YOUR_ACCESS_TOKEN`
5. All endpoints will now include the token in requests

## Implementing RBAC in Routes

### Example: Protecting an Endpoint

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RbacGuard } from './auth/guards/rbac.guard';
import { Permissions } from './auth/decorators/permissions.decorator';

@Post('upload')
@UseGuards(JwtAuthGuard, RbacGuard)
@Permissions('payslips:write')
async uploadPayslips(@UploadedFile() file: Express.Multer.File) {
  // Only authenticated users with 'payslips:write' permission
  return this.payslipService.uploadAndDistribute(file.buffer, file.originalname);
}
```

### Getting Current User

```typescript
import { CurrentUser } from './auth/decorators/current-user.decorator';

@Get('profile')
@UseGuards(JwtAuthGuard)
async getProfile(@CurrentUser() user: any) {
  console.log(user); // { id, email, role, permissions }
  return user;
}
```

## JWT Token Structure

The JWT token contains:
- `sub`: User ID
- `email`: User email
- `role`: User role (user, payroll_manager, admin)
- `permissions`: Array of user permissions
- `exp`: Token expiration time (24 hours from issued)

## Environment Variables

Set in `.env`:

```env
JWT_SECRET=your-secret-key-change-in-production
DATABASE_URL=postgresql://user:password@localhost:5432/payslip_mailer
```

**⚠️ Important**: Change `JWT_SECRET` in production to a strong, random string.

## Adding Users Programmatically

```typescript
import { AuthService } from './auth/auth.service';

constructor(private authService: AuthService) {}

async createNewUser() {
  const result = await this.authService.register({
    email: 'newuser@example.com',
    password: 'password123',
    firstName: 'New',
    lastName: 'User',
  });
  return result;
}
```

## Granting Permissions to Users

```typescript
// Using Prisma
await prisma.user.update({
  where: { id: userId },
  data: {
    permissions: ['payslips:read', 'payslips:write', 'employees:read'],
  },
});
```

## Common Use Cases

### 1. Admin Operations
Admin role automatically gets all permissions. Use `payslips:write` to upload payslips.

### 2. Payroll Manager
Manage payslips and view employees:
- Permissions: `payslips:read`, `payslips:write`, `employees:read`

### 3. HR User (Read-Only)
View employees but cannot modify:
- Permissions: `employees:read`

## Security Best Practices

1. **Use HTTPS in Production**: Always use HTTPS to prevent token interception
2. **Rotate JWT Secret**: Change JWT_SECRET periodically
3. **Strong Passwords**: Enforce strong password policies
4. **Token Expiry**: JWT tokens expire after 24 hours; implement refresh tokens for long-lived sessions
5. **CORS Configuration**: Restrict CORS origins in production
6. **Rate Limiting**: Use the built-in throttler guards for rate limiting

## Troubleshooting

### "Invalid credentials" on login
- Verify email is correct
- Ensure password is correct
- Check if user account is active (`isActive: true`)

### "No user information found" or permission errors
- Ensure token is included in Authorization header
- Token format should be: `Bearer YOUR_TOKEN`
- Check token expiry: `exp` claim in JWT

### "User does not have required permissions"
- Verify user has necessary permissions assigned
- Use Prisma to update user permissions:
  ```bash
  npx prisma studio
  ```

## Next Steps

1. **Implement Token Refresh**: Add refresh token logic for extended sessions
2. **Multi-Tenancy**: Extend RBAC for organization-level access control
3. **Audit Logging**: Track user actions and permission changes
4. **2FA**: Add two-factor authentication for sensitive operations
