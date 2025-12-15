# Memory Optimization & Duplicate Send Prevention

## Overview
This document outlines the memory leak prevention and duplicate send validation implemented in the payslip processing system.

## Memory Leak Prevention

### 1. Batch Processing in Chunks
**Issue**: Processing thousands of payslips at once can cause memory buildup.

**Solution**: Process payslips in batches of 50 to limit memory consumption at any given time.

```typescript
// Process payslips in batches to prevent memory buildup
const BATCH_SIZE = 50;
for (let i = 0; i < payslipsInputs.length; i += BATCH_SIZE) {
  const batch = payslipsInputs.slice(i, i + BATCH_SIZE);
  // Process batch...
  // Clear batch reference
  batch.length = 0;
}
```

### 2. Buffer Cleanup After Processing
**Issue**: Large PDF buffers remain in memory after processing.

**Solution**: Explicitly clear buffer references after use to allow garbage collection.

```typescript
try {
  // Process payslip...
} finally {
  // Clear buffer reference to allow garbage collection
  payslip.pdfBuffer = null as any;
}
```

### 3. Email Batch Processing
**Issue**: Sending thousands of emails concurrently can exhaust memory and overwhelm SMTP server.

**Solution**: Process emails in batches of 10 with delays between batches.

```typescript
const EMAIL_BATCH_SIZE = 10;
for (let i = 0; i < payslips.length; i += EMAIL_BATCH_SIZE) {
  const emailBatch = payslips.slice(i, i + EMAIL_BATCH_SIZE);
  // Send emails...
  emailBatch.length = 0; // Clear reference
  
  // Delay between batches
  if (i + EMAIL_BATCH_SIZE < payslips.length) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

### 4. ZIP File Processing Cleanup
**Issue**: JSZip objects can hold large amounts of memory.

**Solution**: Use try-finally blocks to ensure cleanup.

```typescript
let zip: JSZip | null = null;
try {
  zip = await JSZip.loadAsync(zipBuffer);
  // Process files...
} finally {
  zip = null; // Clear reference
}
```

### 5. Array Cleanup
**Issue**: Large arrays hold references to processed objects.

**Solution**: Clear arrays after processing to allow garbage collection.

```typescript
// Clear the entire payslipsInputs array
payslipsInputs.length = 0;

// Clear payslips array reference
batch.payslips.length = 0;
```

## Duplicate Send Prevention

### 1. Database-Level Filtering
**Issue**: Query might return already-sent payslips.

**Solution**: Filter at database level to only fetch unsent or failed payslips.

```typescript
payslips: {
  where: {
    deletedAt: null,
    OR: [
      { emailSent: false },
      { emailError: { not: null } }, // Include failed sends for retry
    ],
  },
}
```

### 2. Runtime Validation in sendBatch()
**Issue**: Payslip might have been sent between query and send operations.

**Solution**: Double-check before sending each email.

```typescript
// Double-check: Skip if already successfully sent (safety check)
if (payslip.emailSent && payslip.emailSentAt && !payslip.emailError) {
  console.log(`Payslip ${payslip.id} already sent successfully. Skipping.`);
  skippedCount++;
  continue;
}
```

### 3. Validation in resendPayslip()
**Issue**: Admin might accidentally resend a successfully sent payslip.

**Solution**: Validate and prevent resend if already sent without errors.

```typescript
// Prevent resending already successfully sent payslips
if (payslip.emailSent && payslip.emailSentAt && !payslip.emailError) {
  console.warn(`Payslip ${payslipId} was already successfully sent at ${payslip.emailSentAt}. Skipping resend.`);
  return payslip; // Return existing payslip without resending
}
```

### 4. Batch Already Sent Check
**Issue**: Attempting to send a batch where all payslips were already sent.

**Solution**: Return early with informative message.

```typescript
// Check if all payslips already sent successfully
if (batch.payslips.length === 0) {
  console.log(`All payslips in batch ${batchId} have already been sent successfully.`);
  return {
    batchId: batch.uuid,
    // ...
    message: 'All payslips already sent',
  };
}
```

## Response Tracking

### Enhanced Response Fields
The `BatchSendResultDto` now includes:

```typescript
{
  batchId: string;
  payMonth: string;
  totalPayslips: number;     // Total attempted
  successCount: number;       // Successfully sent
  failureCount: number;       // Failed to send
  skippedCount: number;       // Already sent (skipped)
  emailStatus: string;        // completed/partial/failed
  message?: string;           // Optional informative message
  sentAt: Date;
  completedAt: Date;
}
```

## Benefits

### Memory Management
1. **Predictable Memory Usage**: Batch processing limits maximum memory consumption
2. **Faster Garbage Collection**: Explicit cleanup allows V8 to reclaim memory sooner
3. **Prevents Out of Memory Errors**: Large uploads won't crash the application
4. **Better Performance**: Less memory pressure improves overall system performance

### Duplicate Send Prevention
1. **Data Integrity**: Employees don't receive duplicate emails
2. **Audit Trail**: Skipped sends are logged and tracked
3. **Cost Savings**: Prevents unnecessary SMTP usage
4. **User Experience**: Reduces spam and confusion

### SMTP Server Protection
1. **Rate Limiting**: 1-second delay between email batches prevents overwhelming SMTP server
2. **Batch Size Control**: Only 10 concurrent emails at a time
3. **Prevents Blacklisting**: Controlled sending rate avoids spam detection
4. **Retry Support**: Failed emails can be retried without resending successful ones

## Testing Recommendations

### Memory Testing
```bash
# Monitor memory usage during large batch processing
npm run pm2:status

# Check memory growth over time
npm run pm2:monit

# View logs for memory-related warnings
npm run pm2:logs
```

### Duplicate Prevention Testing
```bash
# 1. Upload a batch
curl -X POST http://localhost:5000/payslips/upload \
  -F "file=@payslips.pdf" \
  -F "payMonth=2025-12"

# 2. Send the batch
curl -X POST http://localhost:5000/payslips/batches/:batchId/send

# 3. Try sending again (should skip already sent)
curl -X POST http://localhost:5000/payslips/batches/:batchId/send
# Response should show: skippedCount > 0, message: "All payslips already sent"

# 4. Try resending individual payslip
curl -X POST http://localhost:5000/payslips/:payslipId/resend
# Should return payslip without resending
```

## Monitoring

### Key Metrics to Monitor
1. **Memory Usage**: Should remain stable even with large batches
2. **Skipped Count**: High values might indicate duplicate send attempts
3. **Process Time**: Batch processing should be linear with file count
4. **Email Errors**: Track failed sends for retry

### PM2 Monitoring
```bash
# Check memory usage
npm run pm2:status

# View real-time monitoring
npm run pm2:monit

# Check for restarts (might indicate memory issues)
pm2 list
```

## Configuration

### Adjustable Batch Sizes
Located in `src/payslip/payslip.service.ts`:

```typescript
const BATCH_SIZE = 50;          // Payslip processing batch size
const EMAIL_BATCH_SIZE = 10;    // Email sending batch size
```

**Recommendations**:
- **Small Server** (< 2GB RAM): BATCH_SIZE=25, EMAIL_BATCH_SIZE=5
- **Medium Server** (2-4GB RAM): BATCH_SIZE=50, EMAIL_BATCH_SIZE=10 (default)
- **Large Server** (> 4GB RAM): BATCH_SIZE=100, EMAIL_BATCH_SIZE=20

### Email Batch Delay
Located in `src/payslip/payslip.service.ts`:

```typescript
// Add small delay between batches
await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second
```

**Adjust based on SMTP limits**:
- Most SMTP servers: 1000ms (1 second)
- High-volume SMTP: 500ms (0.5 seconds)
- Restricted SMTP: 2000ms (2 seconds)

## Troubleshooting

### High Memory Usage
**Symptoms**: Memory grows continuously, application crashes

**Solutions**:
1. Reduce `BATCH_SIZE` constant
2. Reduce `EMAIL_BATCH_SIZE` constant
3. Check for memory leaks in custom code
4. Enable Node.js garbage collection: `node --expose-gc dist/main.js`

### Duplicate Emails Being Sent
**Symptoms**: Employees receive multiple copies of payslips

**Check**:
1. Database: `SELECT * FROM Payslip WHERE emailSent = true AND id = ?`
2. Logs: Search for "already sent successfully. Skipping"
3. Validate database constraints are working

### Skipped Count Always Zero
**Symptoms**: All payslips resend even if previously sent

**Check**:
1. Database query in `sendBatch()` - should filter `emailSent = false`
2. Validation logic in send loop
3. Database values: `emailSent`, `emailSentAt`, `emailError`

## Best Practices

1. **Always Monitor Memory**: Use PM2 monitoring during large batches
2. **Test with Large Files**: Validate with batches > 1000 payslips
3. **Check Logs**: Review for skipped sends and memory warnings
4. **Adjust Batch Sizes**: Tune based on server capacity
5. **Regular Restarts**: Schedule application restarts during low-traffic periods
6. **Database Indexes**: Ensure indexes on `emailSent`, `emailStatus`, `uploadId`

## Related Documentation
- [PAYSLIP_BATCH_WORKFLOW.md](./PAYSLIP_BATCH_WORKFLOW.md) - Complete batch workflow
- [PAYSLIP_BATCH_QUICK_REF.md](./PAYSLIP_BATCH_QUICK_REF.md) - Quick reference
- [BATCH_IMPLEMENTATION_SUMMARY.md](./BATCH_IMPLEMENTATION_SUMMARY.md) - Implementation details
