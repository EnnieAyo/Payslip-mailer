# Authentication & Authorization Guide

## Overview

The Payslip-mailer application includes a comprehensive authentication and authorization system built with NestJS, JWT (JSON Web Tokens), and Prisma ORM. This guide covers user authentication, password management, role-based access control (RBAC), and audit logging.

## Table of Contents

1. [Authentication Flow](#authentication-flow)
2. [User Registration & Login](#user-registration--login)
3. [Password Management](#password-management)
4. [JWT Token Management](#jwt-token-management)
5. [Authorization & RBAC](#authorization--rbac)
6. [Audit Logging](#audit-logging)
7. [Security Best Practices](#security-best-practices)
8. [API Endpoints](#api-endpoints)
9. [Configuration](#configuration)

---

## Authentication Flow

### High-Level Architecture

```
User → Login/Register → AuthService → JWT Generation → Protected Routes
                                                            ↓
                                                       JwtAuthGuard
                                                            ↓
                                                       RbacGuard
                                                            ↓
                                                      Endpoint Handler
```

### Components

- **AuthModule** (`src/auth/`): Core authentication module with controllers, services, strategies, guards, and decorators
- **AuthService** (`src/auth/auth.service.ts`): Business logic for authentication operations
- **AuthController** (`src/auth/auth.controller.ts`): HTTP endpoints for auth operations
- **JwtStrategy** (`src/auth/strategies/jwt.strategy.ts`): Passport.js JWT validation strategy
- **JwtAuthGuard** (`src/auth/guards/jwt-auth.guard.ts`): Guard to protect routes requiring JWT
- **RbacGuard** (`src/auth/guards/rbac.guard.ts`): Guard to enforce role-based permissions
- **AuditService** (`src/auth/services/audit.service.ts`): Tracks user actions for security
- **AuditModule** (`src/audit/`): Module exposing audit log endpoints

---

## User Registration & Login

### Registration

**Endpoint:** `POST /auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
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

**Process:**
1. Validates request with `RegisterDto`
2. Checks if user with email already exists (returns 409 Conflict if exists)
3. Hashes password using bcryptjs (salt rounds: 10)
4. Creates user in database with default role "user"
5. Generates JWT token with user claims
6. Returns token and user information

### Login

**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
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

**Security Features:**
- Account locking after 5 failed login attempts
- Inactive account detection
- Failed login attempt tracking
- Password verification using bcrypt comparison
- Reset of failed attempts on successful login
- Login timestamp tracking (`lastLoginAt`)

**Process:**
1. Finds user by email
2. Checks if account is locked or inactive
3. Verifies password against hashed password
4. On password mismatch:
   - Increments failed login attempts
   - Locks account if attempts >= 5
   - Throws UnauthorizedException
5. On success:
   - Resets failed login attempts to 0
   - Updates `lastLoginAt` timestamp
   - Generates JWT token
   - Returns token and user info

---

## Password Management

### Password Reset Flow

The application supports two password reset mechanisms:

#### 1. Forgot Password (Self-Service)

**Endpoint:** `POST /auth/forgot-password`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If an account exists, a reset email has been sent"
}
```

**Process:**
1. Generates a random 6-digit token (100000-999999)
2. Sets token expiration to 15 minutes
3. Stores reset record in database
4. Sends token to user's email via SMTP
5. Returns generic message (doesn't reveal if email exists - security best practice)

**Token Details:**
- Format: 6-digit numeric string
- Expiration: 15 minutes
- Single-use: Can only be used once
- Database tracking: Records creation time, expiration, usage time

#### 2. Reset Password with Token

**Endpoint:** `POST /auth/reset-password-with-token`

**Request Body:**
```json
{
  "token": "123456",
  "newPassword": "NewSecurePassword123!"
}
```

**Response:**
```json
{
  "message": "Password reset successfully"
}
```

**Security Validations:**
- Verifies token exists in database
- Checks token hasn't expired
- Prevents token reuse (marks as used after reset)
- Resets account lock and failed login attempts
- Hashes new password with bcrypt

#### 3. Admin Password Reset

**Endpoint:** `POST /auth/reset-password`

**Requires:** JWT token with `users:write` permission

**Request Body:**
```json
{
  "userId": 1,
  "newPassword": "NewSecurePassword123!"
}
```

**Response:**
```json
{
  "message": "Password reset successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

---

## JWT Token Management

### Token Structure

JWT tokens are signed with HS256 algorithm and contain the following claims:

```json
{
  "sub": 1,                          // User ID
  "email": "user@example.com",       // User email
  "role": "admin",                   // User role
  "permissions": ["users:read", "users:write"],  // Array of permissions
  "iat": 1703068800,                 // Issued at timestamp
  "exp": 1703155200                  // Expiration timestamp (24 hours)
}
```

### Configuration

**Environment Variables:**
```bash
JWT_SECRET=your-super-secret-key-change-in-production
```

**JWT Options (from AuthModule):**
```typescript
JwtModule.register({
  secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  signOptions: { expiresIn: '24h' },
})
```

### Token Validation

Tokens are validated using `JwtStrategy` which:
1. Extracts token from Authorization header: `Bearer <token>`
2. Verifies signature using JWT_SECRET
3. Checks expiration (rejects expired tokens)
4. Validates user still exists and is active
5. Returns validated user object with permissions

### Protecting Routes

Use the `@UseGuards(JwtAuthGuard)` decorator:

```typescript
@Get('protected-resource')
@UseGuards(JwtAuthGuard)
async getProtectedData() {
  // Only authenticated users can access
}
```

---

## Authorization & RBAC

### Role-Based Access Control (RBAC)

The application implements permission-based RBAC using:

1. **User Roles**: Stored in user record (e.g., "user", "admin")
2. **Permissions**: Array of permission strings assigned to users
3. **Permission Format**: `resource:action` (e.g., `users:read`, `payslips:upload`)

### Available Permissions

Common permissions in the system:
- `users:read` - View user information and logs
- `users:write` - Create, update, delete users; reset passwords
- `payslips:upload` - Upload and process payslips
- `payslips:read` - View payslip information
- `payslips:delete` - Delete payslips
- `employees:read` - View employee data
- `employees:write` - Manage employee records

### Using RbacGuard

Combine `JwtAuthGuard` with `RbacGuard` and the `@Permissions()` decorator:

```typescript
@Post('admin-only-endpoint')
@UseGuards(JwtAuthGuard, RbacGuard)
@Permissions('users:write', 'payslips:delete')
async adminAction() {
  // Only users with EITHER permission can access
}
```

**Important:** Multiple permissions are treated with OR logic (user needs at least one)

### Guard Flow

1. **JwtAuthGuard** validates JWT token and extracts user
2. **RbacGuard** checks if user has required permissions:
   - If no permissions required → allows access
   - If permissions required → checks user.permissions array
   - If user has at least one required permission → allows access
   - Otherwise → throws ForbiddenException

### Decorators

#### @Permissions()
Sets required permissions on an endpoint:
```typescript
@Permissions('resource:action', 'other:permission')
```

#### @CurrentUser()
Injects current authenticated user into handler:
```typescript
@Get('profile')
@UseGuards(JwtAuthGuard)
async getProfile(@CurrentUser() user: any) {
  return { user };  // user object from JWT
}
```

---

## Audit Logging

### Overview

The audit system logs all significant user actions for security, compliance, and debugging. Logs are stored in the `AuditLog` table in the database.

### Audit Log Structure

```typescript
interface AuditLogInput {
  userId?: number;           // ID of user performing action
  action: string;            // Action type (e.g., 'LOGIN', 'USER_CREATED')
  resource?: string;         // Resource type (e.g., 'user', 'payslip')
  resourceId?: number;       // ID of affected resource
  details?: Record<string, any>;  // Additional context as JSON
  ipAddress?: string;        // Client IP address
  userAgent?: string;        // Client user agent
  status?: string;           // 'success' or 'failure'
  errorMessage?: string;     // Error message if status is 'failure'
}
```

### Using AuditService

Inject `AuditService` in any service to log actions:

```typescript
import { AuditService } from '../auth/services/audit.service';

constructor(private auditService: AuditService) {}

async createUser(userData) {
  const user = await this.userRepository.create(userData);
  
  await this.auditService.log({
    userId: currentUser.id,
    action: 'USER_CREATED',
    resource: 'user',
    resourceId: user.id,
    details: { email: user.email, role: user.role },
    status: 'success',
  });
  
  return user;
}
```

### Audit API Endpoints

#### Get Audit Logs

**Endpoint:** `GET /audit/logs`

**Requires:** JWT token with `users:read` permission

**Query Parameters:**
- `userId` (optional): Filter by user ID
- `action` (optional): Filter by action type
- `resource` (optional): Filter by resource type
- `limit` (optional, default: 50): Number of records to return
- `offset` (optional, default: 0): Pagination offset

**Response:**
```json
[
  {
    "id": 1,
    "userId": 5,
    "action": "USER_CREATED",
    "resource": "user",
    "resourceId": 10,
    "details": "{\"email\": \"user@example.com\"}",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "status": "success",
    "errorMessage": null,
    "createdAt": "2024-01-15T10:30:00Z",
    "user": {
      "id": 5,
      "email": "admin@example.com",
      "firstName": "Admin",
      "lastName": "User"
    }
  }
]
```

#### Get Audit Trail for Resource

**Endpoint:** `GET /audit/trail/:resourceId/:resource`

**Requires:** JWT token with `users:read` permission

**Example:** `GET /audit/trail/10/user`

**Response:** Array of audit logs for that specific resource

### Common Audit Actions

Standard action types used throughout the application:

| Action | Description |
|--------|-------------|
| `LOGIN` | User logged in successfully |
| `LOGIN_FAILED` | Failed login attempt |
| `LOGOUT` | User logged out |
| `REGISTER` | User registered new account |
| `PASSWORD_RESET_REQUESTED` | User requested password reset |
| `PASSWORD_RESET` | Password was reset |
| `USER_CREATED` | Admin created new user |
| `USER_UPDATED` | User or admin updated user info |
| `USER_DELETED` | User deleted |
| `USER_LOCKED` | Account locked due to failed attempts |
| `USER_UNLOCKED` | Account unlocked by admin |
| `PAYSLIP_UPLOADED` | Payslip file uploaded |
| `PAYSLIP_PROCESSED` | Payslip processed successfully |
| `EMPLOYEE_MATCHED` | Employee matched to payslip |

---

## Security Best Practices

### Password Security

1. **Hashing**: Passwords are hashed using bcryptjs with 10 salt rounds
2. **Never Log**: Passwords are never logged or returned in responses
3. **Validation**: Passwords must meet minimum requirements (defined in DTOs)
4. **Reset Tokens**: 6-digit tokens are single-use and expire after 15 minutes

### Account Lockout

- Account locks after 5 failed login attempts
- Requires admin action to unlock
- Failed attempts reset on successful login
- Inactive accounts cannot login

### JWT Security

1. **Secret Management**: Use strong, unique JWT_SECRET in production
2. **Token Expiration**: Tokens expire after 24 hours
3. **Bearer Token**: Tokens transmitted via Authorization header
4. **No Storage**: Tokens not stored server-side (stateless)

### Permission Management

1. **Least Privilege**: Users assigned minimum necessary permissions
2. **Granular Permissions**: Use specific resource:action format
3. **Permission Validation**: Guards validate permissions before execution
4. **Audit Trail**: All permission-checking actions are logged

### API Security

1. **Rate Limiting**: ThrottlerModule limits requests per endpoint
2. **Input Validation**: DTOs validate all request bodies
3. **Error Messages**: Generic error messages don't reveal internal details
4. **CORS**: Configure CORS in production
5. **HTTPS**: Always use HTTPS in production

### Environment Variables (Production)

```bash
# Change these in production!
JWT_SECRET=generate-a-strong-random-secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@payslip-mailer.com
```

---

## API Endpoints

### Authentication Endpoints

| Method | Endpoint | Public | Description |
|--------|----------|--------|-------------|
| POST | `/auth/register` | ✓ | Register new user |
| POST | `/auth/login` | ✓ | Login with credentials |
| POST | `/auth/forgot-password` | ✓ | Request password reset token |
| POST | `/auth/reset-password-with-token` | ✓ | Reset password with token |
| POST | `/auth/unlock` | ✗ | Unlock locked account (admin) |
| POST | `/auth/reset-password` | ✗ | Reset user password (admin) |

### Audit Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | `/audit/logs` | `users:read` | Get audit logs with filters |
| GET | `/audit/trail/:resourceId/:resource` | `users:read` | Get audit trail for resource |

---

## Configuration

### AuthModule Configuration

Located in `src/auth/auth.module.ts`:

```typescript
@Module({
  imports: [
    PrismaModule,           // Database access
    EmailModule,            // Email sending
    PassportModule,         // Passport.js support
    ConfigModule,           // Environment variables
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [AuthService, JwtStrategy, AuditService],
  controllers: [AuthController],
  exports: [AuthService, AuditService, JwtModule],
})
export class AuthModule {}
```

### Database Schema

The authentication system requires these Prisma models:

```prisma
model User {
  id                    Int      @id @default(autoincrement())
  email                 String   @unique
  password              String
  firstName             String
  lastName              String
  role                  String   @default("user")
  permissions           String[] @default([])
  isActive              Boolean  @default(true)
  isLocked              Boolean  @default(false)
  failedLoginAttempts   Int      @default(0)
  lastLoginAt           DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  auditLogs             AuditLog[]
  passwordResets        PasswordReset[]
}

model PasswordReset {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
}

model AuditLog {
  id           Int      @id @default(autoincrement())
  userId       Int?
  user         User?    @relation(fields: [userId], references: [id])
  action       String
  resource     String?
  resourceId   Int?
  details      String?
  ipAddress    String?
  userAgent    String?
  status       String   @default("success")
  errorMessage String?
  createdAt    DateTime @default(now())
}
```

---

## Troubleshooting

### Common Issues

**1. "Invalid credentials" on login**
- Verify email and password are correct
- Check if account is locked (try requesting password reset)
- Ensure user account is active

**2. "JWT malformed" or token errors**
- Verify JWT_SECRET is set and consistent
- Check token hasn't expired (24-hour expiration)
- Ensure token is sent in Authorization header: `Bearer <token>`

**3. "Forbidden - insufficient permissions"**
- Verify user has required permission in their permissions array
- Check @Permissions decorator on endpoint
- Confirm user role includes the permission

**4. "Account is locked"**
- Admin must unlock using POST /auth/unlock endpoint
- User can request password reset via forgot-password

**5. Password reset token expired**
- Token expires after 15 minutes
- User must request new token via forgot-password
- Check server time is correct

---

## Testing

### Example curl commands

**Register:**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

**Protected Endpoint:**
```bash
curl -X GET http://localhost:3000/audit/logs \
  -H "Authorization: Bearer <access_token>"
```

---

## Related Documentation

- [NestJS Authentication](https://docs.nestjs.com/security/authentication)
- [Passport.js JWT Strategy](http://www.passportjs.org/packages/passport-jwt/)
- [bcryptjs Documentation](https://github.com/dcodeIO/bcrypt.js)
- [Prisma ORM Documentation](https://www.prisma.io/docs/)
