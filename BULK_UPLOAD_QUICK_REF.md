# Employee Bulk Upload - Quick Reference

## Endpoints

### Download Template
```
GET /employees/bulk-upload/template
Authorization: Bearer {token}
Permission: employees:write
Response: Excel file
```

### Upload Employees
```
POST /employees/bulk-upload
Authorization: Bearer {token}
Permission: employees:write
Content-Type: multipart/form-data
Body: file (Excel .xlsx/.xls)
```

## Template Columns

| Column | Required | Type | Example |
|--------|----------|------|---------|
| IPPIS Number | ✅ Yes | String | IPP123456 |
| First Name | ✅ Yes | String | John |
| Last Name | ✅ Yes | String | Doe |
| Email | ✅ Yes | Email | john.doe@example.com |
| Department | ❌ No | String | IT Department |

## Response Format

```json
{
  "totalRecords": 100,
  "successCount": 95,
  "failureCount": 5,
  "errors": [
    {
      "row": 15,
      "ippisNumber": "IPP123456",
      "errors": ["Duplicate IPPIS"]
    }
  ],
  "processingTime": 2543
}
```

## Validation Rules

✅ **IPPIS Number**: Unique, not empty  
✅ **Email**: Valid format, unique  
✅ **Names**: Not empty  
✅ **File**: Excel format only (.xlsx, .xls)  
✅ **Duplicates**: Checked against existing records  

## Quick Test (cURL)

### Download Template
```bash
curl -X GET http://localhost:5000/employees/bulk-upload/template \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o template.xlsx
```

### Upload File
```bash
curl -X POST http://localhost:5000/employees/bulk-upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@employees.xlsx"
```

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Duplicate IPPIS | IPPIS already exists | Use unique IPPIS number |
| Duplicate email | Email already used | Use unique email |
| Invalid email | Wrong format | Use valid email format |
| Empty field | Required field missing | Fill all required fields |
| Wrong file type | Not Excel | Use .xlsx or .xls |

## Performance

- **Small** (<100): ~1-2 seconds
- **Medium** (100-500): ~3-10 seconds
- **Large** (500-1000): ~15-30 seconds
- **Max recommended**: 500 records per file

## Files Created

- `src/employee/dto/bulk-upload.dto.ts` - DTOs
- `src/employee/employee.service.ts` - Service methods (generateTemplate, bulkUpload)
- `src/employee/employee.controller.ts` - API endpoints
- `BULK_UPLOAD_GUIDE.md` - Complete documentation

## Audit Logging

Action: `EMPLOYEES_BULK_UPLOAD`  
Details: totalRecords, successCount, failureCount, processingTime  
Status: success/failure  

## NPM Packages Installed

- `xlsx` - Excel file parsing/generation
- `multer` - File upload handling
- `@nestjs/platform-express` - Express platform
- `class-transformer` - DTO transformation
- `@types/multer` - TypeScript types

## Status

✅ Backend implementation complete  
✅ API endpoints registered  
✅ PM2 running (online)  
✅ Documentation created  
🔄 Frontend integration pending  
