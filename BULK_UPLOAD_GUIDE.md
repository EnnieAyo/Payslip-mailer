# Employee Bulk Upload Feature

## Overview

The Employee Bulk Upload feature allows administrators to import multiple employee records from an Excel file in a single operation. This feature includes validation, error reporting, and audit logging.

## Features

✅ **Excel Template** - Download pre-formatted template  
✅ **Bulk Import** - Upload Excel file with employee data  
✅ **Validation** - Validates each row before insertion  
✅ **Duplicate Detection** - Checks for existing IPPIS numbers and emails  
✅ **Error Reporting** - Detailed row-by-row error messages  
✅ **Audit Trail** - Logs all bulk upload operations  
✅ **Progress Tracking** - Returns success/failure counts  

## API Endpoints

### 1. Download Excel Template

**Endpoint**: `GET /employees/bulk-upload/template`

**Description**: Downloads an Excel template file with sample data and proper column headers.

**Authentication**: Required (JWT + Bearer token)

**Permissions**: `employees:write`

**Response**: Excel file (`employee-upload-template.xlsx`)

**Example**:
```bash
curl -X GET "http://localhost:5000/employees/bulk-upload/template" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o employee-template.xlsx
```

**Template Structure**:
| IPPIS Number | First Name | Last Name | Email | Department |
|--------------|------------|-----------|-------|------------|
| IPP123456 | John | Doe | john.doe@example.com | IT Department |
| IPP123457 | Jane | Smith | jane.smith@example.com | Finance Department |

### 2. Bulk Upload Employees

**Endpoint**: `POST /employees/bulk-upload`

**Description**: Upload an Excel file to import multiple employees at once.

**Authentication**: Required (JWT + Bearer token)

**Permissions**: `employees:write`

**Request**:
- Content-Type: `multipart/form-data`
- Body: Excel file (`file` field)
- Accepted formats: `.xlsx`, `.xls`

**Response**: `BulkUploadResultDto`

```json
{
  "totalRecords": 100,
  "successCount": 95,
  "failureCount": 5,
  "errors": [
    {
      "row": 15,
      "ippisNumber": "IPP123789",
      "errors": [
        "Employee with IPPIS IPP123789 already exists"
      ]
    },
    {
      "row": 23,
      "ippisNumber": "IPP124000",
      "errors": [
        "Email john@example.com is already registered"
      ]
    }
  ],
  "processingTime": 2543
}
```

**Example using cURL**:
```bash
curl -X POST "http://localhost:5000/employees/bulk-upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@employees.xlsx"
```

**Example using JavaScript/Fetch**:
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('http://localhost:5000/employees/bulk-upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData,
});

const result = await response.json();
console.log(`Success: ${result.successCount}, Failed: ${result.failureCount}`);
```

## Excel File Format

### Required Columns

| Column Name | Type | Required | Description | Example |
|-------------|------|----------|-------------|---------|
| **IPPIS Number** | String | Yes | Unique employee identifier | IPP123456 |
| **First Name** | String | Yes | Employee's first name | John |
| **Last Name** | String | Yes | Employee's last name | Doe |
| **Email** | Email | Yes | Valid email address | john.doe@example.com |
| **Department** | String | No | Employee's department | IT Department |

### Column Name Variations

The system expects exact column names as shown above. Make sure your Excel file uses these exact headers.

### Data Validation Rules

1. **IPPIS Number**:
   - Must be unique (no duplicates in database)
   - Cannot be empty
   - String format

2. **First Name**:
   - Cannot be empty
   - String format

3. **Last Name**:
   - Cannot be empty
   - String format

4. **Email**:
   - Must be valid email format
   - Must be unique (no duplicates in database)
   - Cannot be empty

5. **Department**:
   - Optional field
   - String format

## Workflow

### Step 1: Download Template

1. Navigate to employee management page
2. Click "Download Template" button
3. Excel file downloads automatically
4. Template includes:
   - Proper column headers
   - Sample data rows
   - Pre-formatted columns

### Step 2: Fill Template

1. Open the downloaded Excel file
2. **Keep the header row** (Row 1)
3. Replace sample data with actual employee data
4. Add as many rows as needed
5. Save the file

**Important Notes**:
- Do not modify column headers
- Do not add extra columns
- Remove sample rows or replace with real data
- Ensure no empty rows between data

### Step 3: Upload File

1. Click "Upload Employees" button
2. Select your filled Excel file
3. Click "Upload"
4. Wait for processing (progress indicator shown)

### Step 4: Review Results

After upload completes, you'll see:
- **Total Records**: Number of rows processed
- **Success Count**: Successfully imported employees
- **Failure Count**: Rows that failed validation
- **Error Details**: Specific errors for each failed row

**Example Result Display**:
```
Upload Complete!
✅ Successfully imported: 95 employees
❌ Failed to import: 5 employees
⏱️ Processing time: 2.5 seconds

Errors:
- Row 15: Employee with IPPIS IPP123789 already exists
- Row 23: Email john@example.com is already registered
- Row 45: Invalid email format
- Row 67: First Name is required
- Row 89: IPPIS Number is required
```

## Error Handling

### Common Errors

1. **Duplicate IPPIS Number**
   ```
   Employee with IPPIS IPP123456 already exists
   ```
   **Solution**: Check existing employees or use a different IPPIS number

2. **Duplicate Email**
   ```
   Email john.doe@example.com is already registered
   ```
   **Solution**: Use a unique email address

3. **Invalid Email Format**
   ```
   email must be an email
   ```
   **Solution**: Provide a valid email (e.g., user@domain.com)

4. **Missing Required Field**
   ```
   firstName should not be empty
   ```
   **Solution**: Fill in all required fields

5. **Invalid File Format**
   ```
   Only Excel files (.xlsx, .xls) are allowed
   ```
   **Solution**: Upload Excel file, not CSV or other formats

6. **Empty File**
   ```
   Excel file is empty
   ```
   **Solution**: Add at least one data row below headers

### Best Practices

✅ **Do's**:
- Download and use the official template
- Verify data before uploading
- Keep a backup of your Excel file
- Review error messages carefully
- Upload in batches (e.g., 100-500 records per file)
- Test with a small file first

❌ **Don'ts**:
- Don't modify column headers
- Don't include empty rows
- Don't upload files larger than 10MB
- Don't include duplicate records in same file
- Don't use CSV files (use Excel format)

## Performance

### Processing Speed

- **Small files** (<100 records): ~1-2 seconds
- **Medium files** (100-500 records): ~3-10 seconds
- **Large files** (500-1000 records): ~15-30 seconds

### Limitations

- **Maximum file size**: 10 MB (configurable)
- **Recommended batch size**: 500 records per upload
- **Memory limit**: 500 MB (PM2 auto-restart)

### Optimization Tips

1. **Split large files**: If you have 2000+ records, split into multiple files
2. **Pre-validate data**: Check for duplicates before uploading
3. **Upload during off-peak hours**: For very large imports
4. **Monitor progress**: Keep browser window open during upload

## Audit Trail

All bulk upload operations are logged in the audit system:

**Action**: `EMPLOYEES_BULK_UPLOAD`

**Details Logged**:
- User who performed the upload
- Total records processed
- Success/failure counts
- Processing time
- Error status
- Timestamp

**Audit Log Example**:
```json
{
  "userId": 1,
  "action": "EMPLOYEES_BULK_UPLOAD",
  "resource": "employee",
  "details": {
    "totalRecords": 100,
    "successCount": 95,
    "failureCount": 5,
    "processingTime": 2543,
    "hasErrors": true
  },
  "status": "success",
  "createdAt": "2025-12-14T16:30:00Z"
}
```

## Integration Example (React Frontend)

```typescript
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

function EmployeeBulkUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleDownloadTemplate = async () => {
    const response = await fetch(
      'http://localhost:5000/employees/bulk-upload/template',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee-upload-template.xlsx';
    a.click();
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(
        'http://localhost:5000/employees/bulk-upload',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();
      setResult(data);
      
      if (data.failureCount === 0) {
        alert(`Success! Imported ${data.successCount} employees`);
      } else {
        alert(
          `Imported ${data.successCount} employees. ${data.failureCount} failed.`
        );
      }
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <button onClick={handleDownloadTemplate}>
        Download Template
      </button>

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <button onClick={handleUpload} disabled={!file || uploading}>
        {uploading ? 'Uploading...' : 'Upload Employees'}
      </button>

      {result && (
        <div>
          <h3>Upload Results</h3>
          <p>Total: {result.totalRecords}</p>
          <p>Success: {result.successCount}</p>
          <p>Failed: {result.failureCount}</p>
          <p>Time: {result.processingTime}ms</p>
          
          {result.errors.length > 0 && (
            <div>
              <h4>Errors:</h4>
              <ul>
                {result.errors.map((err: any, i: number) => (
                  <li key={i}>
                    Row {err.row} ({err.ippisNumber}): {err.errors.join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Security

### Access Control

- **Authentication**: JWT token required
- **Authorization**: `employees:write` permission required
- **File validation**: Only Excel files accepted
- **Size limits**: 10MB maximum file size

### Data Validation

- All fields validated before database insertion
- Email format validation
- Duplicate detection (IPPIS and email)
- SQL injection protection via Prisma ORM
- Input sanitization (trim whitespace)

## Troubleshooting

### Upload fails immediately

**Check**:
1. File format is `.xlsx` or `.xls`
2. File size is under 10MB
3. You have `employees:write` permission
4. Authorization token is valid

### All rows fail validation

**Check**:
1. Column headers match exactly (case-sensitive)
2. Required fields are filled
3. Email addresses are valid format
4. No empty rows between data

### Slow processing

**Solutions**:
1. Reduce file size (split into smaller batches)
2. Check server resources (PM2 monitor)
3. Upload during off-peak hours
4. Check database connection

### Partial import (some success, some failures)

**This is normal!** Review error messages:
- Duplicates are skipped (already exist)
- Invalid data is rejected (validation errors)
- Successfully imported records are saved

**Action**: Fix errors in Excel file and re-upload failed rows

## Future Enhancements

Potential improvements:
- [ ] CSV format support
- [ ] Bulk update (modify existing employees)
- [ ] Preview before import
- [ ] Download error report as Excel
- [ ] Real-time progress updates (WebSocket)
- [ ] Scheduled imports
- [ ] Email notification on completion
- [ ] Duplicate merge options
- [ ] Dry-run mode (validation only)
