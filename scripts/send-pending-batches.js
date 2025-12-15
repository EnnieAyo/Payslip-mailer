#!/usr/bin/env node

/**
 * Send Pending Payslip Batches
 * 
 * This script fetches all pending batches and sends their emails.
 * It can be run manually or scheduled via cron.
 * 
 * Usage:
 *   node scripts/send-pending-batches.js
 * 
 * Environment Variables:
 *   API_URL - Base URL of the API (default: http://localhost:5000)
 *   API_TOKEN - JWT token for authentication (required)
 * 
 * Crontab Example:
 *   # Run every day at 6 AM
 *   0 6 * * * cd /path/to/project && API_TOKEN=your_token node scripts/send-pending-batches.js >> /var/log/payslip-cron.log 2>&1
 */

const API_URL = process.env.API_URL || 'http://localhost:5000';
const API_TOKEN = process.env.API_TOKEN;

if (!API_TOKEN) {
  console.error('ERROR: API_TOKEN environment variable is required');
  process.exit(1);
}

async function fetchPendingBatches() {
  const response = await fetch(`${API_URL}/payslips/batches/pending`, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch pending batches: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function sendBatch(batchId) {
  const response = await fetch(`${API_URL}/payslips/batches/${batchId}/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`Failed to send batch ${batchId}: ${error.message}`);
  }

  return response.json();
}

async function main() {
  const startTime = new Date();
  console.log(`[${startTime.toISOString()}] Starting batch email send process...`);

  try {
    // Fetch pending batches
    const batches = await fetchPendingBatches();
    console.log(`Found ${batches.length} pending batch(es)`);

    if (batches.length === 0) {
      console.log('No pending batches to send. Exiting.');
      return;
    }

    // Send each batch
    let totalSuccess = 0;
    let totalFailure = 0;
    const results = [];

    for (const batch of batches) {
      console.log(`\nProcessing batch ${batch.uuid} (${batch.payMonth})...`);
      console.log(`  - Files: ${batch.processedFiles}`);
      console.log(`  - Created: ${batch.createdAt}`);

      try {
        const result = await sendBatch(batch.uuid);
        
        totalSuccess += result.successCount;
        totalFailure += result.failureCount;

        results.push({
          batchId: batch.uuid,
          payMonth: batch.payMonth,
          status: 'success',
          ...result,
        });

        console.log(`  ✓ Batch sent successfully`);
        console.log(`    - Sent: ${result.successCount}`);
        console.log(`    - Failed: ${result.failureCount}`);
        console.log(`    - Status: ${result.emailStatus}`);
        
      } catch (error) {
        console.error(`  ✗ Failed to send batch ${batch.uuid}:`, error.message);
        
        results.push({
          batchId: batch.uuid,
          payMonth: batch.payMonth,
          status: 'error',
          error: error.message,
        });
      }
    }

    // Summary
    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n${'='.repeat(60)}`);
    console.log('SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`Batches processed: ${batches.length}`);
    console.log(`Total emails sent: ${totalSuccess}`);
    console.log(`Total emails failed: ${totalFailure}`);
    console.log(`Duration: ${duration}s`);
    console.log(`Completed at: ${endTime.toISOString()}`);
    console.log(`${'='.repeat(60)}\n`);

    // Exit with appropriate code
    if (results.some(r => r.status === 'error')) {
      console.error('Some batches failed to send. Check logs for details.');
      process.exit(1);
    } else if (totalFailure > 0) {
      console.warn('All batches processed, but some emails failed to send.');
      process.exit(0); // Still exit successfully since batches were sent
    } else {
      console.log('All batches sent successfully!');
      process.exit(0);
    }

  } catch (error) {
    console.error('FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
