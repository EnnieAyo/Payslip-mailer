import { REDIS_PAYSILP_QUEUE } from "@/constant";
import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PrismaService } from "@/prisma/prisma.service";
import { AuditService } from "@/auth/services/audit.service";
import { PdfService } from "@/pdf/pdf.service";
import { EmployeeService } from "@/employee/employee.service";
import { EmailService } from "@/email/email.service";
import { Logger } from "@nestjs/common";

@Processor(REDIS_PAYSILP_QUEUE, {
  concurrency: 1, // Process 1 job at a time for payslips to avoid memory issues
  limiter: {
    max: 5, // Max 5 jobs
    duration: 60000, // per 60 seconds
  },
})
export class PayslipQueueConsumer extends WorkerHost {
  private readonly logger = new Logger(PayslipQueueConsumer.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private pdfService: PdfService,
    private employeeService: EmployeeService,
    private emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    try {
      if (job.name === 'payslip-upload') {
        const result = await this.processPayslipUpload(job);
        this.logger.log(`Completed job ${job.id} successfully`);
        return result;
      } else if (job.name === 'payslip-send') {
        const result = await this.processPayslipSend(job);
        this.logger.log(`Completed job ${job.id} successfully`);
        return result;
      } else {
        throw new Error(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Job ${job.id} failed:`, error);
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed with error:`, error.message);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Job ${job.id} started processing`);
  }

  async processPayslipUpload(job: Job<{
    pdfBuffer: Buffer;
    fileName: string;
    payMonth: string;
    userId?: number;
    uploadId: number;
  }>) {
    const { pdfBuffer, fileName, payMonth, userId, uploadId } = job.data;
    this.logger.log(`Processing Payslip Upload Job ${job.id} for upload ${uploadId}`);

    const startTime = Date.now();

    try {
      // Convert pdfBuffer to proper Buffer if it was serialized from Redis
      const buffer = Buffer.isBuffer(pdfBuffer)
        ? pdfBuffer
        : Buffer.from((pdfBuffer as any).data);

      // Update upload status to processing
      await this.prisma.payslipUpload.update({
        where: { id: uploadId },
        data: { status: 'processing' },
      });

      // Update progress: Starting
      await job.updateProgress({
        stage: 'parsing',
        processed: 0,
        percentage: 0,
      });

      // Determine if the uploaded file is a ZIP archive. If so,
      // extract contained PDFs (recursively) and then split each
      // extracted PDF. Otherwise, split the single uploaded PDF.
      let payslipsInputs: { ippisNumber: string | null; pdfBuffer: Buffer; sourceFileName?: string }[] = [];

      if (fileName.toLowerCase().endsWith('.zip')) {
        const extracted = await this.pdfService.extractPdfsFromZip(buffer);
        for (const f of extracted) {
          const parts = await this.pdfService.splitBulkPdf(f.pdfBuffer, uploadId.toString());
          for (const p of parts) {
            payslipsInputs.push({ ...p, sourceFileName: f.fileName });
          }
        }
      } else {
        const parts = await this.pdfService.splitBulkPdf(buffer, uploadId.toString());
        payslipsInputs = parts;
      }

      const totalFiles = payslipsInputs.length;

      // Update upload with the actual total files found
      await this.prisma.payslipUpload.update({
        where: { id: uploadId },
        data: { totalFiles },
      });

      await job.updateProgress({
        stage: 'processing',
        processed: 0,
        total: totalFiles,
        percentage: 5,
      });

      let processedCount = 0;
      let failedCount = 0;

      // Process payslips in batches to prevent memory buildup
      const BATCH_SIZE = 50;
      for (let i = 0; i < payslipsInputs.length; i += BATCH_SIZE) {
        const batch = payslipsInputs.slice(i, i + BATCH_SIZE);

        for (const payslip of batch) {
          try {
            const employee = await this.employeeService.findByIppisNumber(
              payslip.ippisNumber || 'IPPIS4536',
            );

            if (!employee) {
              this.logger.warn(
                `Employee with IPPIS number ${payslip.ippisNumber} not found`,
              );
              failedCount++;
              continue;
            }

            // Save payslip to database (without sending email)
            await this.prisma.payslip.create({
              data: {
                ippisNumber: payslip.ippisNumber || '',
                fileName: `${payslip.ippisNumber}-${fileName.replace('.zip', '.pdf')}`,
                filePath: await this.pdfService.savePdfFile(
                  payslip.pdfBuffer,
                  `${payslip.ippisNumber}.pdf`,
                  uploadId.toString(),
                ),
                // Prisma `Bytes` maps to `Uint8Array` — convert Node Buffer to Uint8Array
                pdfContent: new Uint8Array(payslip.pdfBuffer),
                employeeId: employee.id,
                uploadId: uploadId,
                payMonth,
                createdBy: userId,
              },
            });

            processedCount++;
          } finally {
            // Clear buffer reference to allow garbage collection
            payslip.pdfBuffer = null as any;
          }
        }

        // Update progress
        const percentage = Math.min(95, Math.round(((i + batch.length) / totalFiles) * 95) + 5);
        await job.updateProgress({
          stage: 'processing',
          processed: processedCount + failedCount,
          total: totalFiles,
          percentage,
          processedCount,
          failedCount,
        });

        // Force garbage collection hint by clearing batch reference
        batch.length = 0;
      }

      // Clear the entire payslipsInputs array
      payslipsInputs.length = 0;

      const processingTime = (Date.now() - startTime) / 1000;

      // Update upload status to processed (ready for email sending)
      await this.prisma.payslipUpload.update({
        where: { id: uploadId },
        data: {
          status: 'processed',
          processedFiles: processedCount,
          totalFiles: processedCount + failedCount,
          updatedBy: userId,
        },
      });

      // Update final progress
      await job.updateProgress({
        stage: 'completed',
        processed: processedCount + failedCount,
        total: processedCount + failedCount,
        percentage: 100,
        processedCount,
        failedCount,
      });

      // Log audit
      if (userId) {
        await this.auditService.log({
          userId,
          action: 'PAYSLIP_BATCH_UPLOADED_COMPLETED',
          resource: 'payslip_upload',
          resourceId: uploadId,
          details: {
            jobId: job.id,
            fileName,
            payMonth,
            totalFiles: processedCount + failedCount,
            processedFiles: processedCount,
            failedFiles: failedCount,
            processingTime: processingTime + 's',
          },
          status: 'success',
        });
      }

      return {
        uploadId: uploadId,
        processedFiles: processedCount,
        failedFiles: failedCount,
        totalFiles: processedCount + failedCount,
        payMonth,
        processingTime,
      };
    } catch (error: any) {
      this.logger.error(`Payslip upload failed: ${error.message}`, error.stack);

      // Update upload status to failed
      await this.prisma.payslipUpload.update({
        where: { id: uploadId },
        data: {
          status: 'failed',
        },
      });

      // Log audit
      if (userId) {
        await this.auditService.log({
          userId,
          action: 'PAYSLIP_BATCH_UPLOADED_FAILED',
          resource: 'payslip_upload',
          resourceId: uploadId,
          details: {
            jobId: job.id,
            fileName,
            payMonth,
            error: error.message,
            stack: error.stack,
          },
          status: 'failure',
          errorMessage: error.message,
        });
      }

      throw error; // Re-throw to mark job as failed
    }
  }

  async processPayslipSend(job: Job<{
    batchId: number;
    batchUuid: string;
    userId?: number;
  }>) {
    const { batchId, batchUuid, userId } = job.data;
    this.logger.log(`Processing Payslip Send Job ${job.id} for batch ${batchUuid}`);

    const startTime = Date.now();

    try {
      // Fetch batch with unsent payslips
      const batch = await this.prisma.payslipUpload.findFirst({
        where: {
          id: batchId,
          deletedAt: null,
        },
        include: {
          payslips: {
            where: {
              deletedAt: null,
              // Only include payslips that haven't been sent OR had errors
              OR: [
                { emailSent: false },
                { emailError: { not: null } }, // Include failed sends for retry
              ],
            },
            include: {
              employee: true,
            },
          },
        },
      });

      if (!batch) {
        throw new Error('Batch not found');
      }

      // Check if all payslips already sent successfully
      if (batch.payslips.length === 0) {
        this.logger.log(`All payslips in batch ${batchUuid} have already been sent successfully.`);
        
        await this.prisma.payslipUpload.update({
          where: { id: batchId },
          data: {
            status: 'completed',
            emailStatus: 'completed',
            completedAt: new Date(),
          },
        });

        return {
          batchId: batchUuid,
          payMonth: batch.payMonth,
          totalPayslips: 0,
          successCount: 0,
          failureCount: 0,
          skippedCount: 0,
          emailStatus: 'completed',
          message: 'All payslips already sent',
        };
      }

      const totalPayslips = batch.payslips.length;

      // Update progress: Starting
      await job.updateProgress({
        stage: 'sending',
        processed: 0,
        total: totalPayslips,
        percentage: 0,
      });

      let successCount = 0;
      let failureCount = 0;
      let skippedCount = 0;

      // Process emails in batches to prevent memory buildup
      const EMAIL_BATCH_SIZE = 10;
      for (let i = 0; i < batch.payslips.length; i += EMAIL_BATCH_SIZE) {
        const emailBatch = batch.payslips.slice(i, i + EMAIL_BATCH_SIZE);

        for (const payslip of emailBatch) {
          try {
            // Double-check: Skip if already successfully sent (safety check)
            if (payslip.emailSent && payslip.emailSentAt && !payslip.emailError) {
              this.logger.log(`Payslip ${payslip.id} already sent successfully. Skipping.`);
              skippedCount++;
              continue;
            }

            const pdfBuffer = Buffer.from(payslip.pdfContent as Uint8Array);
            const emailSent = await this.emailService.sendPayslip(
              payslip.employee.email,
              pdfBuffer,
              payslip.fileName,
              `${payslip.employee.firstName} ${payslip.employee.lastName}`,
            );

            if (emailSent) {
              await this.prisma.payslip.update({
                where: { id: payslip.id },
                data: {
                  emailSent: true,
                  emailSentAt: new Date(),
                  emailError: null,
                  updatedBy: userId,
                },
              });
              successCount++;
            } else {
              await this.prisma.payslip.update({
                where: { id: payslip.id },
                data: {
                  emailError: 'Failed to send email',
                  updatedBy: userId,
                },
              });
              failureCount++;
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await this.prisma.payslip.update({
              where: { id: payslip.id },
              data: {
                emailError: errorMessage,
                updatedBy: userId,
              },
            });
            failureCount++;
            this.logger.error(`Failed to send payslip ${payslip.id}:`, error);
          }
        }

        // Update progress
        const processed = successCount + failureCount + skippedCount;
        const percentage = Math.round((processed / totalPayslips) * 100);
        await job.updateProgress({
          stage: 'sending',
          processed,
          total: totalPayslips,
          percentage,
          successCount,
          failureCount,
          skippedCount,
        });

        // Clear batch reference to allow garbage collection
        emailBatch.length = 0;

        // Add small delay between batches to prevent overwhelming the email server
        if (i + EMAIL_BATCH_SIZE < batch.payslips.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Clear payslips array reference
      batch.payslips.length = 0;

      const processingTime = (Date.now() - startTime) / 1000;

      // Determine final email status
      let emailStatus = 'completed';
      if (failureCount > 0 && successCount > 0) {
        emailStatus = 'partial';
      } else if (failureCount > 0 && successCount === 0) {
        emailStatus = 'failed';
      }

      // Update batch with final counts and status
      await this.prisma.payslipUpload.update({
        where: { id: batchId },
        data: {
          status: 'completed',
          emailStatus,
          successCount,
          failureCount,
          completedAt: new Date(),
          updatedBy: userId,
        },
      });

      // Update final progress
      await job.updateProgress({
        stage: 'completed',
        processed: totalPayslips,
        total: totalPayslips,
        percentage: 100,
        successCount,
        failureCount,
        skippedCount,
      });

      // Log audit
      if (userId) {
        await this.auditService.log({
          userId,
          action: 'PAYSLIP_BATCH_SENT_COMPLETED',
          resource: 'payslip_upload',
          resourceId: batchId,
          details: {
            jobId: job.id,
            batchId: batchUuid,
            payMonth: batch.payMonth,
            totalPayslips,
            successCount,
            failureCount,
            skippedCount,
            emailStatus,
            processingTime: processingTime + 's',
          },
          status: emailStatus === 'failed' ? 'failure' : 'success',
        });
      }

      return {
        batchId: batchUuid,
        payMonth: batch.payMonth,
        totalPayslips,
        successCount,
        failureCount,
        skippedCount,
        emailStatus,
        processingTime,
      };
    } catch (error: any) {
      this.logger.error(`Batch send failed: ${error.message}`, error.stack);

      // Update batch status to failed
      await this.prisma.payslipUpload.update({
        where: { id: batchId },
        data: {
          emailStatus: 'failed',
        },
      });

      // Log error
      if (userId) {
        await this.auditService.log({
          userId,
          action: 'PAYSLIP_BATCH_SENT_FAILED',
          resource: 'payslip_upload',
          resourceId: batchId,
          details: {
            jobId: job.id,
            batchId: batchUuid,
            error: error.message,
            stack: error.stack,
          },
          status: 'failure',
          errorMessage: error.message,
        });
      }

      throw error; // Re-throw to mark job as failed
    }
  }
}
