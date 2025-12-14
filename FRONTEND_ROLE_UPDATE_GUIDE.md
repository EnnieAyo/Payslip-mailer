# Frontend Role Management Update Guide

## Overview
The backend roles are now persisted in the PostgreSQL database instead of in-memory storage. The API structure remains the same, so minimal frontend changes are needed.

## API Changes (Already Compatible)

### Roles Endpoint Response Structure
The response structure has NOT changed, so your frontend should work as-is:

```typescript
// GET /roles
{
  "success": true,
  "message": "4 items returned",
  "data": [
    {
      "name": "admin",
      "description": "Full system access",
      "permissions": ["payslips:read", "payslips:write", ...]
    },
    {
      "name": "payroll_manager",
      "description": "Manages payslip uploads and distribution",
      "permissions": ["payslips:read", "payslips:write", ...]
    },
    {
      "name": "user",
      "description": "Basic user access",
      "permissions": ["payslips:read", "employees:read"]
    }
  ],
  "meta": {
    "total": 4,
    "page": 0,
    "limit": 4,
    "totalPages": 0
  }
}
```

## What Changed on Backend

1. **Persistence**: Roles now persist across server restarts
2. **System Roles**: Admin, payroll_manager, and user are marked as `isSystem: true` and cannot be deleted/modified
3. **Custom Roles**: Users can now create custom roles that persist in the database
4. **Audit Logging**: All role operations (create, update, delete) are logged

## Frontend Verification Checklist

### ✅ Already Working (No Changes Needed)
- Role fetching from `/roles` endpoint
- Role creation via POST `/roles`
- Role updates via PUT `/roles/:name`
- Role deletion via DELETE `/roles/:name`
- Permission fetching from `/roles/permissions`

### 🔍 Optional Enhancements

#### 1. Add System Role Protection UI
Update your role management page to show which roles are system-protected:

```typescript
// In your roles table/list component
interface Role {
  name: string;
  description: string;
  permissions: string[];
  isSystem?: boolean; // Optional for backward compatibility
}

// Display a badge for system roles
{role.name === 'admin' || role.name === 'payroll_manager' || role.name === 'user' ? (
  <span className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">
    System Role
  </span>
) : null}

// Disable edit/delete buttons for system roles
<button
  disabled={['admin', 'payroll_manager', 'user'].includes(role.name)}
  className={`btn ${systemRole ? 'opacity-50 cursor-not-allowed' : ''}`}
>
  Edit
</button>
```

#### 2. Add Success Messages for Persistence
Update your success messages to indicate persistence:

```typescript
// After creating a role
toast.success('Role created and saved to database');

// After updating a role
toast.success('Role updated and changes persisted');
```

#### 3. Update Role Types (Optional)
If you want to add the `isSystem` field to your TypeScript types:

```typescript
// types/index.ts
export interface Role {
  name: string;
  description: string;
  permissions: string[];
  isSystem?: boolean; // New optional field
}
```

## Testing Your Frontend

### Test Case 1: Verify Role Persistence
1. Create a custom role in the UI (e.g., "hr_specialist")
2. Restart your backend server
3. Navigate back to roles page
4. ✅ Verify the custom role still exists

### Test Case 2: System Role Protection
1. Try to edit "admin" role
2. ✅ Should see error: "Cannot modify system roles"
3. Try to delete "user" role
4. ✅ Should see error: "Cannot delete system roles"

### Test Case 3: Custom Role Management
1. Create a custom role with specific permissions
2. Edit the custom role's permissions
3. Delete the custom role
4. ✅ All operations should work without errors

## API Client Verification

Your existing API client should work without changes. Verify these methods exist:

```typescript
// lib/api-client.ts
class ApiClient {
  // Should already exist - no changes needed
  async getRoles() {
    const response = await fetch(`${this.baseUrl}/roles`, {
      headers: { Authorization: `Bearer ${this.getToken()}` }
    });
    return response.json();
  }

  async createRole(data: { name: string; description: string; permissions: string[] }) {
    const response = await fetch(`${this.baseUrl}/roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getToken()}`
      },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  async updateRole(name: string, data: Partial<{ description: string; permissions: string[] }>) {
    const response = await fetch(`${this.baseUrl}/roles/${name}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getToken()}`
      },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  async deleteRole(name: string) {
    const response = await fetch(`${this.baseUrl}/roles/${name}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.getToken()}` }
    });
    return response.json();
  }

  async getAvailablePermissions() {
    const response = await fetch(`${this.baseUrl}/roles/permissions`, {
      headers: { Authorization: `Bearer ${this.getToken()}` }
    });
    return response.json();
  }
}
```

## Error Handling Updates

The backend now returns these specific errors:

```typescript
// Handle in your error handling middleware
{
  "success": false,
  "message": "Cannot modify system roles",
  "data": null
}

{
  "success": false,
  "message": "Cannot delete system roles",
  "data": null
}

{
  "success": false,
  "message": "Role with this name already exists",
  "data": null
}
```

Make sure your error handling shows these messages to users.

## Summary

**The frontend should work without any changes** because:
- ✅ API endpoints remain the same
- ✅ Request/response structure unchanged
- ✅ Permission model unchanged
- ✅ Role structure (name, description, permissions) unchanged

**Optional enhancements:**
- Show "System Role" badges in UI
- Disable edit/delete for system roles in frontend
- Update success messages to mention persistence
- Add `isSystem` field to TypeScript types (optional)

## Need Help?

If you encounter any issues:
1. Check browser console for API errors
2. Verify backend is running: `curl http://localhost:5000/roles`
3. Check authentication token is valid
4. Review network tab in browser DevTools

The role management system is now fully functional with database persistence! 🎉
