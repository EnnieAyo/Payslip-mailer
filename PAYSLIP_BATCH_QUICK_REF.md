# Payslip Batch Workflow - Quick Reference

## 🚀 Quick Start

### 1. Upload Payslips (Without Sending)
```bash
curl -X POST http://localhost:5000/payslips/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@payslips.pdf" \
  -F "payMonth=2025-12"
```

### 2. View Pending Batches
```bash
curl http://localhost:5000/payslips/batches/pending \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Send Batch Emails
```bash
curl -X POST http://localhost:5000/payslips/batches/BATCH_UUID/send \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📋 All Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/payslips/upload` | Upload & process (no emails) |
| GET | `/payslips/batches` | List all batches |
| GET | `/payslips/batches/pending` | List ready-to-send batches |
| GET | `/payslips/batches/:batchId` | Get batch details |
| POST | `/payslips/batches/:batchId/send` | Send batch emails |

## 📊 Status Values

### Upload Status
- `pending` → `processing` → `processed` → `completed`
- `failed` (if error)

### Email Status
- `pending` → `sending` → `completed` / `partial` / `failed`

## 🔧 payMonth Format

**Format:** `YYYY-MM`

**Examples:**
- December 2025: `2025-12`
- January 2026: `2026-01`
- March 2024: `2024-03`

**Validation:** Must match regex `^\d{4}-(0[1-9]|1[0-2])$`

## ⚙️ Cron Job Setup

### Basic Script
```javascript
// scripts/send-pending.js
const fetch = require('node-fetch');

async function sendPending() {
  const res = await fetch('http://localhost:5000/payslips/batches/pending', {
    headers: { 'Authorization': `Bearer ${process.env.API_TOKEN}` }
  });
  
  const batches = await res.json();
  
  for (const batch of batches) {
    await fetch(`http://localhost:5000/payslips/batches/${batch.uuid}/send`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.API_TOKEN}` }
    });
    console.log(`Sent batch ${batch.uuid}`);
  }
}

sendPending();
```

### Crontab
```bash
# Every day at 6 AM
0 6 * * * cd /path/to/project && node scripts/send-pending.js
```

## 🔍 Query Parameters

### GET /payslips/batches

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 10) |
| payMonth | string | Filter by pay month |
| status | string | Filter by status |

**Examples:**
```bash
# Page 2
?page=2&limit=20

# December 2025 batches
?payMonth=2025-12

# Only processed batches
?status=processed

# Combine filters
?payMonth=2025-12&status=completed
```

## 📝 Response Examples

### Upload Response
```json
{
  "uploadId": 123,
  "batchId": "abc-123-def",
  "processedFiles": 25,
  "failedFiles": 0,
  "totalFiles": 25,
  "payMonth": "2025-12"
}
```

### Batch List Response
```json
{
  "data": [...],
  "total": 10,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

### Send Batch Response
```json
{
  "batchId": "abc-123-def",
  "payMonth": "2025-12",
  "totalPayslips": 25,
  "successCount": 25,
  "failureCount": 0,
  "emailStatus": "completed",
  "sentAt": "2025-12-15T10:30:00Z",
  "completedAt": "2025-12-15T10:35:00Z"
}
```

## 🔐 Permissions

| Endpoint | Permission Required |
|----------|---------------------|
| Upload | `payslips:write` |
| View batches | `payslips:read` |
| Send batch | `payslips:write` |

## ⚠️ Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "payMonth is required" | Missing payMonth | Include payMonth in YYYY-MM format |
| "must be in YYYY-MM format" | Invalid format | Use correct format: 2025-12 |
| "Batch not in correct status" | Batch not processed | Wait for processing to complete |
| "Batch not found" | Invalid batchId | Check UUID/ID is correct |

## 🎯 Typical Workflow

```
1. Upload payslips
   POST /payslips/upload
   payMonth=2025-12
   
2. Review batch
   GET /payslips/batches/BATCH_UUID
   
3. Send emails
   POST /payslips/batches/BATCH_UUID/send
   
4. Monitor results
   GET /payslips/batches/BATCH_UUID
```

## 📊 Database Fields

### PayslipUpload
- `payMonth`: string (YYYY-MM)
- `processedFiles`: number
- `emailStatus`: string
- `sentAt`: DateTime
- `completedAt`: DateTime

### Payslip
- `uploadId`: number (FK)
- `payMonth`: string (YYYY-MM)
- `emailError`: string (nullable)

## 🔄 Migration

**Applied:** `20251215151209_add_paymonth_and_batch_relations`

Adds:
- `payMonth` field to both tables
- `uploadId` relation in Payslip
- `emailStatus`, `sentAt`, `completedAt` in PayslipUpload
- Indexes on payMonth, status, emailStatus

---

**Full Documentation:** [PAYSLIP_BATCH_WORKFLOW.md](./PAYSLIP_BATCH_WORKFLOW.md)
