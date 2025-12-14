# Soft Delete Implementation

## Overview

Soft delete functionality has been implemented across the application. When records are "deleted", they are not permanently removed from the database. Instead, a `deletedAt` timestamp is set, marking the record as deleted while preserving the data.

## Architecture

### Database Schema

Added `deletedAt` field (nullable DateTime) to the following models:
- **Employee** - Soft delete for employee records
- **Payslip** - Soft delete for payslip records  
- **PayslipUpload** - Soft delete for upload records
- **User** - Soft delete for user accounts
- **Role** - Soft delete for roles

### Implementation Approach

**Manual Filtering** - Services explicitly filter out soft-deleted records by adding `deletedAt: null` to queries. This provides:
- Full control over soft delete behavior
- Easy debugging and troubleshooting
- Clear, explicit query logic
- No magic/hidden behavior

All service methods include:
- `findMany()` - `where: { deletedAt: null }`
- `findFirst()` / `findUnique()` - `where: { id, deletedAt: null }`
- `update()` - Checks `deletedAt: null` before updating
- `delete()` - Converts to `update({ deletedAt: new Date() })`

### PrismaService Extensions

**File**: `src/prisma/prisma.service.ts`

Added three utility methods:

```typescript
// Permanently delete a record (use with caution!)
await prisma.hardDelete('employee', { id: 1 });

// Restore a soft-deleted record
await prisma.restore('employee', { id: 1 });

// Find only soft-deleted records
await prisma.findDeleted('employee', { 
  take: 10, 
  skip: 0 
});
```

## Service Changes

Each service has been updated with:

### New Methods

1. **`restore(id, userId?)`** - Restores a soft-deleted record
   - Checks if record exists in deleted state
   - Sets `deletedAt` back to `null`
   - Logs audit trail of restoration

2. **`findDeleted(page?, limit?)`** - Retrieves soft-deleted records
   - Paginated list of deleted records
   - Ordered by `deletedAt` descending (most recently deleted first)

### Updated Services

- ✅ **EmployeeService** - `restore()`, `findDeleted()`
- ✅ **UserService** - `restore()`, `findDeleted()`
- ✅ **RoleService** - `restore()`, `findDeleted()`

### Existing Methods (No Changes Required)

- `delete()` / `remove()` - Now performs soft delete automatically via middleware
- `findAll()` - Automatically excludes deleted records
- `findOne()` - Automatically excludes deleted records
- `update()` - Cannot update deleted records (filtered by middleware)

## Controller Endpoints

### New Endpoints

Each resource controller now has:

1. **Restore endpoint**
   ```
   PATCH /employees/:id/restore
   PATCH /users/:id/restore
   PATCH /roles/:name/restore
   ```
   - Requires write permissions
   - Returns restored record
   - Logs audit trail

2. **List deleted endpoint**
   ```
   GET /employees/deleted/list?page=1&limit=10
   GET /users/deleted/list?page=1&limit=10
   GET /roles/deleted/list
   ```
   - Requires read permissions
   - Returns paginated list of deleted records

## Usage Examples

### Delete (Soft Delete)

```typescript
// Existing delete call - now does soft delete automatically
await employeeService.remove(1, userId);
// Sets deletedAt = now, record still in database

// User won't see this employee in normal queries
await employeeService.findAll(); // Excludes deleted
```

### Restore

```typescript
// Restore a deleted employee
await employeeService.restore(1, userId);
// Sets deletedAt = null, record visible again

// Employee now appears in queries
await employeeService.findAll(); // Includes restored employee
```

### View Deleted Records

```typescript
// See all deleted employees
const deleted = await employeeService.findDeleted(1, 10);
// Returns employees where deletedAt IS NOT NULL
```

### Hard Delete (Permanent)

```typescript
// Permanently remove from database (use with extreme caution!)
await prisma.hardDelete('employee', { id: 1 });
// Record permanently deleted, cannot be restored
```

## Audit Trail

All soft delete operations are automatically logged:

- **Delete**: Action `EMPLOYEE_DELETED`, `USER_DELETED`, `ROLE_DELETED`
- **Restore**: Action `EMPLOYEE_RESTORED`, `USER_RESTORED`, `ROLE_RESTORED`

Audit logs include:
- User who performed the action
- Timestamp
- Resource details (name, email, etc.)
- Success/failure status

## Migration

Migration: `20251214143750_add_soft_delete`

Adds nullable `deletedAt` column to:
- employees
- payslips
- payslip_uploads
- users
- roles

**Note**: Existing records have `deletedAt = NULL` (not deleted).

## Benefits

1. **Data Preservation** - No accidental permanent data loss
2. **Audit Compliance** - Full history of deletions and restorations
3. **Easy Recovery** - Restore deleted records without database backups
4. **Transparent** - Existing code works without modification
5. **Cascade Safety** - Related records remain intact (e.g., payslips when employee deleted)

## Best Practices

### Do's
✅ Use normal `delete()` methods for soft delete  
✅ Use `restore()` to recover deleted records  
✅ Use `findDeleted()` to view deleted records  
✅ Check audit logs for deletion history  

### Don'ts
❌ Don't use `hardDelete()` unless absolutely necessary  
❌ Don't manually set `deletedAt` in service code (use restore/delete methods)  
❌ Don't query deleted records directly (use `findDeleted()` helper)  

## Future Enhancements

Potential additions:
- Automatic permanent deletion after X days
- Bulk restore operations
- Recycle bin UI in frontend
- Admin dashboard for deleted records management

## Testing

Test soft delete functionality:

```bash
# Create an employee
POST /employees { ... }

# Delete (soft delete)
DELETE /employees/1

# Verify not in list
GET /employees # Should not include employee 1

# View deleted
GET /employees/deleted/list # Should include employee 1

# Restore
PATCH /employees/1/restore

# Verify in list again
GET /employees # Should include employee 1
```
