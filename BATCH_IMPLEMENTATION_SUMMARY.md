# Payslip Batch Processing - Implementation Summary

## 🎯 Changes Overview

The payslip upload system has been completely restructured to support **batch processing with delayed email sending**. Users can now upload payslips, review them, and then manually trigger email sending or use a cron job.

## ✅ What Changed

### 1. Database Schema Updates

**Migration:** `20251215151209_add_paymonth_and_batch_relations`

#### PayslipUpload Model
- ✅ Added `payMonth` (string, YYYY-MM format) - **Required**
- ✅ Added `processedFiles` (int) - Count of files saved to DB
- ✅ Added `emailStatus` (string) - pending, sending, completed, partial, failed
- ✅ Added `sentAt` (DateTime) - When email sending started
- ✅ Added `completedAt` (DateTime) - When email sending finished
- ✅ Added relation to payslips (one-to-many)
- ✅ Added indexes on payMonth, status, emailStatus

#### Payslip Model
- ✅ Added `uploadId` (int) - **Required** - Foreign key to PayslipUpload
- ✅ Added `payMonth` (string, YYYY-MM format) - **Required**
- ✅ Added `emailError` (string, nullable) - Error message if email fails
- ✅ Added relation to upload (many-to-one)
- ✅ Added indexes on uploadId, payMonth

### 2. Service Layer Changes

**File:** `src/payslip/payslip.service.ts`

#### Updated Methods
- ✅ `uploadAndDistribute()` → `uploadAndProcess()` - Now requires `payMonth` parameter
  - No longer sends emails immediately
  - Sets status to "processed" instead of "completed"
  - Sets emailStatus to "pending"
  - Returns processedFiles/failedFiles instead of successCount/failureCount
  - Includes audit logging

#### New Methods
- ✅ `getBatches(page, limit, payMonth?, status?)` - List all batches with filtering
- ✅ `getBatchDetails(batchId)` - Get batch with all payslips and employee details
- ✅ `sendBatch(batchId, userId?)` - Send all emails in a batch
- ✅ `getPendingBatches()` - Get batches ready to send (processed but not sent)

### 3. Controller Updates

**File:** `src/payslip/payslip.controller.ts`

#### Updated Endpoints
- ✅ `POST /payslips/upload` - Now requires `payMonth` in request body
  - Validation: Must be YYYY-MM format
  - Returns batchId, processedFiles, failedFiles

#### New Endpoints
- ✅ `GET /payslips/batches` - List all batches (with pagination & filtering)
- ✅ `GET /payslips/batches/pending` - List batches ready to send
- ✅ `GET /payslips/batches/:batchId` - Get batch details
- ✅ `POST /payslips/batches/:batchId/send` - Trigger batch email sending

### 4. DTOs Updated

**File:** `src/payslip/dto/payslip.dto.ts`

- ✅ Added `UploadPayslipDto` - For upload endpoint with payMonth validation
- ✅ Updated `PayslipDto` - Added uploadId, payMonth, emailError
- ✅ Updated `PayslipUploadDto` - Added payMonth, processedFiles, emailStatus, sentAt, completedAt
- ✅ Updated `UploadResultDto` - Changed to processedFiles/failedFiles, added batchId, payMonth
- ✅ Added `BatchSendResultDto` - For batch send response

### 5. PDF Service Update

**File:** `src/pdf/pdf.service.ts`

- ✅ Updated IPPIS regex to match formats:
  - `IPPIS Number: 96426`
  - `IPPIS Number: FTC96426`
  - `IPPIS Number: TI96426`
  - `IPPIS Number: NA96426`

### 6. Documentation

- ✅ Created `PAYSLIP_BATCH_WORKFLOW.md` - Complete workflow documentation
- ✅ Created `PAYSLIP_BATCH_QUICK_REF.md` - Quick reference guide
- ✅ Created `scripts/send-pending-batches.js` - Cron job script

## 📊 New Workflow

### Before (Old Flow)
```
Upload → Extract → Save → Send Emails Immediately → Completed
```

### After (New Flow)
```
Upload → Extract → Save → [WAIT] → Manual/Cron Trigger → Send Emails → Completed
```

## 🔄 Status Management

### Upload Status Flow
```
pending → processing → processed → completed (or failed)
```

### Email Status Flow
```
pending → sending → completed/partial/failed
```

## 📡 API Changes

### Breaking Changes

#### POST /payslips/upload
**Before:**
```bash
curl -X POST http://localhost:5000/payslips/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@payslips.pdf"
```

**After:**
```bash
curl -X POST http://localhost:5000/payslips/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@payslips.pdf" \
  -F "payMonth=2025-12"  # NEW: Required field
```

**Response Changed:**
```json
// Before
{
  "uploadId": "123",
  "successCount": 25,
  "failureCount": 0,
  "totalFiles": 25
}

// After
{
  "uploadId": 123,
  "batchId": "uuid-string",
  "processedFiles": 25,
  "failedFiles": 0,
  "totalFiles": 25,
  "payMonth": "2025-12"
}
```

### New Endpoints

1. **GET /payslips/batches** - List batches
2. **GET /payslips/batches/pending** - List ready-to-send batches
3. **GET /payslips/batches/:batchId** - Get batch details
4. **POST /payslips/batches/:batchId/send** - Send batch emails

## 🔐 Permissions

All endpoints require authentication + appropriate permissions:
- Upload: `payslips:write`
- View batches: `payslips:read`
- Send batch: `payslips:write`

## 🤖 Cron Job Integration

### Manual Script
```bash
# Set environment variable
export API_TOKEN="your_jwt_token"

# Run script
node scripts/send-pending-batches.js
```

### Crontab
```bash
# Add to crontab (crontab -e)
0 6 * * * cd /path/to/Payslip-mailer && API_TOKEN=token node scripts/send-pending-batches.js >> /var/log/payslip-cron.log 2>&1
```

### PM2 Cron (Optional)
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    // ... existing app config
    {
      name: 'batch-sender-cron',
      script: './scripts/send-pending-batches.js',
      cron_restart: '0 6 * * *',
      autorestart: false,
    },
  ],
};
```

## 📝 Migration Notes

### For Existing Data
The migration script handles existing data by:
1. Setting `payMonth` to current year-month for existing uploads
2. Creating a "legacy_upload" batch for orphaned payslips
3. Linking existing payslips to the legacy batch

### No Data Loss
- ✅ All existing payslips preserved
- ✅ All existing upload records preserved
- ✅ Relationships properly established

## 🧪 Testing

### Test Upload
```bash
curl -X POST http://localhost:5000/payslips/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.pdf" \
  -F "payMonth=2025-12"
```

### Test Get Batches
```bash
curl http://localhost:5000/payslips/batches \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Send Batch
```bash
curl -X POST http://localhost:5000/payslips/batches/BATCH_UUID/send \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📊 Audit Logging

New audit events:
- `PAYSLIP_BATCH_UPLOADED` - When batch is uploaded
- `PAYSLIP_BATCH_SENT` - When batch emails are sent

Query audit logs:
```bash
curl "http://localhost:5000/audit-logs?action=PAYSLIP_BATCH_SENT" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🎯 Benefits

1. **Review Before Send** - Upload payslips and review before sending
2. **Batch Management** - Organize by pay month
3. **Error Tracking** - Detailed error messages per payslip
4. **Cron Support** - Automated sending via cron jobs
5. **Audit Trail** - Complete history of uploads and sends
6. **Status Tracking** - Clear status for uploads and emails
7. **Failure Handling** - Individual payslip error tracking
8. **Scalability** - Process large batches without immediate email load

## 🔧 Deployment Status

- ✅ Database migration applied
- ✅ Application built successfully
- ✅ PM2 restarted with new code
- ✅ Status: **ONLINE** (102.4 MB memory)
- ✅ All endpoints tested and working

## 📚 Documentation Files

1. [PAYSLIP_BATCH_WORKFLOW.md](./PAYSLIP_BATCH_WORKFLOW.md) - Complete workflow guide
2. [PAYSLIP_BATCH_QUICK_REF.md](./PAYSLIP_BATCH_QUICK_REF.md) - Quick reference
3. [scripts/send-pending-batches.js](./scripts/send-pending-batches.js) - Cron script

## 🚀 Next Steps

1. **Frontend Integration**: Update frontend to use new upload endpoint with payMonth
2. **Cron Setup**: Configure cron job for automated batch sending
3. **Monitoring**: Set up monitoring for batch send failures
4. **Testing**: Test with real payslip data
5. **Training**: Train users on new workflow

---

**Implemented:** December 15, 2025
**Migration:** 20251215151209_add_paymonth_and_batch_relations
**Status:** ✅ Production Ready
