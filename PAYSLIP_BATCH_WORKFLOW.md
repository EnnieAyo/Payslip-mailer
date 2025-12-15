# Payslip Batch Workflow Documentation

## 🎯 Overview

The payslip system has been updated to support batch processing with delayed email sending. This allows you to:
1. Upload and process payslips without sending emails immediately
2. Review processed batches before sending
3. Manually trigger batch email sending or use a cron job
4. Track batches by pay month (YYYY-MM format)

## 📋 Workflow

### Step 1: Upload Payslips
Upload PDF or ZIP files with a `payMonth` identifier. The system processes the files and saves payslips to the database **without sending emails**.

**Status after upload:** 
- Upload status: `processed`
- Email status: `pending`

### Step 2: Review Batch
View batch details to verify all payslips were processed correctly.

### Step 3: Send Batch Emails
Manually trigger email sending for a batch, or set up a cron job to send automatically.

**Status after sending:**
- Upload status: `completed`
- Email status: `completed`, `partial`, or `failed`

## 🔧 Database Schema Changes

### PayslipUpload Model
```prisma
model PayslipUpload {
  id              Int       @id @default(autoincrement())
  uuid            String    @unique @default(uuid())
  fileName        String
  filePath        String
  payMonth        String    // NEW: Format YYYY-MM (e.g., "2025-12")
  totalFiles      Int
  processedFiles  Int       @default(0)  // NEW: Files saved to DB
  successCount    Int       @default(0)  // Emails sent successfully
  failureCount    Int       @default(0)  // Emails failed
  status          String    @default("pending")  // pending, processing, processed, completed, failed
  emailStatus     String    @default("pending")  // NEW: pending, sending, completed, partial, failed
  sentAt          DateTime? // NEW: When email sending started
  completedAt     DateTime? // NEW: When email sending completed
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?
  
  payslips        Payslip[]
}
```

### Payslip Model
```prisma
model Payslip {
  id          Int       @id @default(autoincrement())
  uuid        String    @unique @default(uuid())
  ippisNumber String
  fileName    String
  filePath    String
  pdfContent  Bytes
  employeeId  Int
  employee    Employee  @relation(...)
  uploadId    Int       // NEW: Link to batch
  upload      PayslipUpload @relation(...)
  payMonth    String    // NEW: Format YYYY-MM
  emailSent   Boolean   @default(false)
  emailSentAt DateTime?
  emailError  String?   // NEW: Error message if send fails
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?
}
```

## 📡 API Endpoints

### 1. Upload Payslips (Process Only)
**POST** `/payslips/upload`

Uploads and processes payslips without sending emails.

**Request:**
```
Content-Type: multipart/form-data

file: <PDF or ZIP file>
payMonth: "2025-12"
```

**Response:**
```json
{
  "uploadId": 123,
  "batchId": "uuid-string",
  "processedFiles": 25,
  "failedFiles": 0,
  "totalFiles": 25,
  "payMonth": "2025-12"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:5000/payslips/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@payslips_december.pdf" \
  -F "payMonth=2025-12"
```

---

### 2. Get All Batches
**GET** `/payslips/batches`

Get list of all upload batches with pagination and filtering.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `payMonth` (optional): Filter by pay month (e.g., "2025-12")
- `status` (optional): Filter by status (pending, processing, processed, completed, failed)

**Response:**
```json
{
  "data": [
    {
      "id": 123,
      "uuid": "batch-uuid",
      "fileName": "payslips_december.pdf",
      "filePath": "uploads/123-abc",
      "payMonth": "2025-12",
      "totalFiles": 25,
      "processedFiles": 25,
      "successCount": 25,
      "failureCount": 0,
      "status": "completed",
      "emailStatus": "completed",
      "sentAt": "2025-12-15T10:30:00Z",
      "completedAt": "2025-12-15T10:35:00Z",
      "createdAt": "2025-12-15T10:00:00Z",
      "updatedAt": "2025-12-15T10:35:00Z",
      "_count": {
        "payslips": 25
      }
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

**cURL Example:**
```bash
# Get all batches
curl http://localhost:5000/payslips/batches \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Filter by pay month
curl "http://localhost:5000/payslips/batches?payMonth=2025-12" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Filter by status
curl "http://localhost:5000/payslips/batches?status=processed" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 3. Get Pending Batches
**GET** `/payslips/batches/pending`

Get batches that are processed but not yet sent (ready for email sending).

**Response:**
```json
[
  {
    "id": 123,
    "uuid": "batch-uuid",
    "fileName": "payslips_december.pdf",
    "payMonth": "2025-12",
    "totalFiles": 25,
    "processedFiles": 25,
    "status": "processed",
    "emailStatus": "pending",
    "_count": {
      "payslips": 25
    }
  }
]
```

**cURL Example:**
```bash
curl http://localhost:5000/payslips/batches/pending \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 4. Get Batch Details
**GET** `/payslips/batches/:batchId`

Get detailed information about a specific batch including all payslips.

**Parameters:**
- `batchId`: Batch UUID or numeric ID

**Response:**
```json
{
  "id": 123,
  "uuid": "batch-uuid",
  "fileName": "payslips_december.pdf",
  "payMonth": "2025-12",
  "totalFiles": 25,
  "processedFiles": 25,
  "successCount": 20,
  "failureCount": 5,
  "status": "completed",
  "emailStatus": "partial",
  "payslips": [
    {
      "id": 456,
      "uuid": "payslip-uuid",
      "ippisNumber": "96426",
      "fileName": "96426-payslip.pdf",
      "emailSent": true,
      "emailSentAt": "2025-12-15T10:30:00Z",
      "emailError": null,
      "employee": {
        "id": 789,
        "uuid": "employee-uuid",
        "ippisNumber": "96426",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@example.com",
        "department": "IT"
      }
    }
  ]
}
```

**cURL Example:**
```bash
curl http://localhost:5000/payslips/batches/batch-uuid \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 5. Send Batch Emails
**POST** `/payslips/batches/:batchId/send`

Trigger email sending for all payslips in a batch.

**Parameters:**
- `batchId`: Batch UUID or numeric ID

**Response:**
```json
{
  "batchId": "batch-uuid",
  "payMonth": "2025-12",
  "totalPayslips": 25,
  "successCount": 25,
  "failureCount": 0,
  "emailStatus": "completed",
  "sentAt": "2025-12-15T10:30:00Z",
  "completedAt": "2025-12-15T10:35:00Z"
}
```

**Email Status Values:**
- `completed`: All emails sent successfully
- `partial`: Some emails sent, some failed
- `failed`: All emails failed to send

**cURL Example:**
```bash
curl -X POST http://localhost:5000/payslips/batches/batch-uuid/send \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🤖 Setting Up Cron Job

You can set up a cron job to automatically send pending batches.

### Option 1: Node.js Script

Create a file `scripts/send-pending-batches.js`:

```javascript
const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'http://localhost:5000';
const JWT_TOKEN = process.env.API_TOKEN; // Store securely

async function sendPendingBatches() {
  try {
    // Get pending batches
    const response = await fetch(`${API_URL}/payslips/batches/pending`, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
      },
    });

    const batches = await response.json();
    console.log(`Found ${batches.length} pending batches`);

    // Send each batch
    for (const batch of batches) {
      console.log(`Sending batch ${batch.uuid} (${batch.payMonth})...`);
      
      const sendResponse = await fetch(`${API_URL}/payslips/batches/${batch.uuid}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`,
        },
      });

      const result = await sendResponse.json();
      console.log(`Batch ${batch.uuid}: ${result.successCount} sent, ${result.failureCount} failed`);
    }
  } catch (error) {
    console.error('Error sending batches:', error);
    process.exit(1);
  }
}

sendPendingBatches();
```

### Option 2: Crontab Entry

```bash
# Run every day at 6 AM
0 6 * * * cd /path/to/project && node scripts/send-pending-batches.js >> /var/log/payslip-cron.log 2>&1
```

### Option 3: PM2 Cron

Add to `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'payslip-mailer-api',
      script: './dist/main.js',
      // ... existing config
    },
    {
      name: 'batch-sender-cron',
      script: './scripts/send-pending-batches.js',
      cron_restart: '0 6 * * *', // Every day at 6 AM
      autorestart: false,
      watch: false,
    },
  ],
};
```

## 📊 Status Flow Diagram

```
Upload → Processing → Processed → Sending → Completed
                         ↓
                      Failed
```

### Status Transitions

**Upload Status:**
1. `pending` → Initial state
2. `processing` → Files being extracted and saved
3. `processed` → All files saved, ready for email sending
4. `sending` → Emails being sent (email only)
5. `completed` → All emails sent
6. `failed` → Upload or processing failed

**Email Status:**
1. `pending` → No emails sent yet
2. `sending` → Email sending in progress
3. `completed` → All emails sent successfully
4. `partial` → Some emails sent, some failed
5. `failed` → All emails failed

## 🔍 Monitoring & Troubleshooting

### Check Batch Status

```bash
# Get specific batch details
curl http://localhost:5000/payslips/batches/BATCH_UUID \
  -H "Authorization: Bearer TOKEN"
```

### View Failed Emails

Payslips with `emailSent: false` and `emailError: "message"` indicate failures.

### Retry Failed Emails

Use the existing resend endpoint:

```bash
curl -X POST http://localhost:5000/payslips/resend/PAYSLIP_ID \
  -H "Authorization: Bearer TOKEN"
```

## 📝 Audit Logging

All batch operations are logged:

- **PAYSLIP_BATCH_UPLOADED**: When a batch is uploaded
- **PAYSLIP_BATCH_SENT**: When batch emails are sent
- **PAYSLIP_RESENT**: When individual payslips are resent

Query audit logs:

```bash
curl http://localhost:5000/audit-logs?action=PAYSLIP_BATCH_SENT \
  -H "Authorization: Bearer TOKEN"
```

## 🎯 Best Practices

1. **Upload Early**: Upload payslips a day before sending to review
2. **Review First**: Always check batch details before sending
3. **Monitor Status**: Check emailStatus after sending
4. **Handle Failures**: Investigate and retry failed emails
5. **Use Cron Wisely**: Schedule during low-traffic hours
6. **Archive Old Batches**: Soft delete old batches after a retention period

## 🔐 Permissions Required

- **Upload**: `payslips:write`
- **View Batches**: `payslips:read`
- **Send Batch**: `payslips:write`

## 📚 Related Endpoints

- `GET /payslips/employee/:employeeId` - Get payslips by employee
- `GET /payslips/unsent` - Get individual unsent payslips
- `POST /payslips/resend/:payslipId` - Resend individual payslip

---

**Migration Applied:** `20251215151209_add_paymonth_and_batch_relations`

**Updated:** December 15, 2025
