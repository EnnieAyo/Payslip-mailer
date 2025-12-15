# 🚀 Quick Integration Reference

## Copy Commands (Run from frontend root)

```bash
# Step 1: Copy types
cp ../Payslip-mailer/frontend-integration/types/bulk-upload.types.ts ./types/

# Step 2: Create bulk upload page directory
mkdir -p app/employees/bulk-upload

# Step 3: Copy bulk upload page
cp ../Payslip-mailer/frontend-integration/app/employees/bulk-upload/page.tsx ./app/employees/bulk-upload/

# Step 4: Copy API client additions
cp ../Payslip-mailer/frontend-integration/lib/api-client-bulk-upload.ts ./lib/
```

## Code Snippets

### Add to `lib/api-client.ts`
```typescript
import { BulkUploadResultDto } from '@/types/bulk-upload.types';

export async function downloadEmployeeTemplate(): Promise<Blob> {
  const token = localStorage.getItem('token');
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/employees/bulk-upload/template`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to download template');
  return response.blob();
}

export async function bulkUploadEmployees(file: File): Promise<BulkUploadResultDto> {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/employees/bulk-upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) throw new Error('Failed to upload file');
  return response.json();
}
```

### Add to `app/employees/page.tsx`
```typescript
// Imports
import { Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Inside component
const router = useRouter();

// In JSX (add next to "Add Employee" button)
<Button
  onClick={() => router.push('/employees/bulk-upload')}
  className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white"
>
  <Upload className="w-4 h-4 mr-2" />
  Mass Upload
</Button>
```

## File Structure After Integration

```
payslip-mailer-frontend/
├── types/
│   └── bulk-upload.types.ts          ✅ NEW
├── lib/
│   ├── api-client.ts                 ✏️ MODIFIED
│   └── api-client-bulk-upload.ts     ✅ NEW (optional)
└── app/
    └── employees/
        ├── page.tsx                   ✏️ MODIFIED
        └── bulk-upload/
            └── page.tsx               ✅ NEW
```

## Test Checklist

- [ ] Backend running: `npm run pm2:status` in backend
- [ ] Frontend running: `npm run dev` in frontend
- [ ] Login successful
- [ ] Navigate to `/employees`
- [ ] "Mass Upload" button visible
- [ ] Click button → redirects to `/employees/bulk-upload`
- [ ] "Download Template" button works
- [ ] Upload valid file → success message + results
- [ ] Upload invalid file → error table displays
- [ ] "Back to Employees" button works

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Template won't download | Check backend is running, check API URL |
| Upload fails | Verify file is .xlsx/.xls, check permissions |
| Button not showing | Verify imports, check router initialization |
| Errors not in table | Check error structure matches backend DTO |

## Sample Test Excel

| IPPIS Number | First Name | Last Name | Email | Department |
|--------------|------------|-----------|-------|------------|
| IPPIS001 | John | Doe | john.doe@example.com | IT |
| IPPIS002 | Jane | Smith | jane.smith@example.com | HR |

## Backend Endpoints

- **GET** `/employees/bulk-upload/template` - Download template
- **POST** `/employees/bulk-upload` - Upload file

Both require JWT auth + `employees:write` permission

---

📖 **Full Guide:** [FRONTEND_BULK_UPLOAD_INTEGRATION.md](./FRONTEND_BULK_UPLOAD_INTEGRATION.md)
