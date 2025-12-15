import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PdfService } from '../pdf/pdf.service';
import { EmployeeService } from '../employee/employee.service';
import { AuditService } from '../auth/services/audit.service';

@Injectable()
export class PayslipService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private pdfService: PdfService,
    private employeeService: EmployeeService,
    private auditService: AuditService,
  ) {}

  async uploadAndProcess(pdfBuffer: Buffer, fileName: string, payMonth: string, userId?: number) {
    const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create upload record
    const upload = await this.prisma.payslipUpload.create({
      data: {
        fileName,
        filePath: `uploads/${uploadId}`,
        payMonth,
        totalFiles: 1,
        status: 'processing',
        emailStatus: 'pending',
        createdBy: userId,
      },
    });

    try {
      // Determine if the uploaded file is a ZIP archive. If so,
      // extract contained PDFs (recursively) and then split each
      // extracted PDF. Otherwise, split the single uploaded PDF.
      let payslipsInputs: { ippisNumber: string | null; pdfBuffer: Buffer; sourceFileName?: string }[] = [];

      if (fileName.toLowerCase().endsWith('.zip')) {
        const extracted = await this.pdfService.extractPdfsFromZip(pdfBuffer);
        for (const f of extracted) {
          const parts = await this.pdfService.splitBulkPdf(f.pdfBuffer, uploadId);
          for (const p of parts) {
            payslipsInputs.push({ ...p, sourceFileName: f.fileName });
          }
        }
      } else {
        const parts = await this.pdfService.splitBulkPdf(pdfBuffer, uploadId);
        payslipsInputs = parts;
      }

      // Update upload with the actual total files found
      await this.prisma.payslipUpload.update({
        where: { id: upload.id },
        data: { totalFiles: payslipsInputs.length },
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
              console.warn(
                `Employee with IPPIS number ${payslip.ippisNumber} not found`,
              );
              failedCount++;
              continue;
            }

            // Save payslip to database (without sending email)
            await this.prisma.payslip.create({
              data: {
                ippisNumber: payslip.ippisNumber || '',
                fileName: `${payslip.ippisNumber}-${fileName.replace('.zip','.pdf')}`,
                filePath: await this.pdfService.savePdfFile(
                  payslip.pdfBuffer,
                  `${payslip.ippisNumber}.pdf`,
                  uploadId,
                ),
                // Prisma `Bytes` maps to `Uint8Array` — convert Node Buffer to Uint8Array
                pdfContent: new Uint8Array(payslip.pdfBuffer),
                employeeId: employee.id,
                uploadId: upload.id,
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

        // Force garbage collection hint by clearing batch reference
        batch.length = 0;
      }

      // Clear the entire payslipsInputs array
      payslipsInputs.length = 0;

      // Update upload status to processed (ready for email sending)
      await this.prisma.payslipUpload.update({
        where: { id: upload.id },
        data: {
          status: 'processed',
          processedFiles: processedCount,
          totalFiles: processedCount + failedCount,
          updatedBy: userId,
        },
      });

      // Log audit
      if (userId) {
        await this.auditService.log({
          userId,
          action: 'PAYSLIP_BATCH_UPLOADED',
          resource: 'payslip_upload',
          resourceId: upload.id,
          details: {
            fileName,
            payMonth,
            totalFiles: processedCount + failedCount,
            processedFiles: processedCount,
            failedFiles: failedCount,
          },
          status: 'success',
        });
      }

      return {
        uploadId: upload.id,
        batchId: upload.uuid,
        processedFiles: processedCount,
        failedFiles: failedCount,
        totalFiles: processedCount + failedCount,
        payMonth,
      };
    } catch (error) {
      // Update upload status to failed
      await this.prisma.payslipUpload.update({
        where: { id: upload.id },
        data: {
          status: 'failed',
        },
      });

      // Log audit
      if (userId) {
        await this.auditService.log({
          userId,
          action: 'PAYSLIP_BATCH_UPLOADED',
          resource: 'payslip_upload',
          resourceId: upload.id,
          details: {
            fileName,
            payMonth,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
          status: 'failure',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      throw error;
    }
  }

  async getUploadStatus(uploadId: string) {
    return this.prisma.payslipUpload.findUnique({
      where: { id: parseInt(uploadId) },
    });
  }

  async getPayslipsByEmployee(employeeId: number, page = 0, limit = 10) {
    const take = limit;
    const skip = (page-1>0)? (page-1) * limit : 0;

    const [total, data] = await Promise.all([
      this.prisma.payslip.count({ where: { employeeId } }),
      this.prisma.payslip.findMany({
        omit: { pdfContent: true, filePath: true },
        where: { employeeId },
        take,
        skip,
        orderBy: { id: 'desc' },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take) || 0,
    };
  }

  async getUnsentPayslips(page = 0, limit = 10) {
    const take = limit;
    const skip = (page-1>0)? (page-1) * limit : 0;

    const [total, data] = await Promise.all([
      this.prisma.payslip.count({ where: { emailSent: false } }),
      this.prisma.payslip.findMany({
        omit: { pdfContent: true, filePath: true },
        where: { emailSent: false },
        include: { employee: true },
        take,
        skip,
        orderBy: { id: 'desc' },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take) || 0,
    };
  }

  async resendPayslip(payslipId: number, userId?: number) {
    const payslip = await this.prisma.payslip.findUnique({
      where: { id: payslipId },
      include: { employee: true },
    });

    if (!payslip) {
      throw new Error('Payslip not found');
    }

    // Prevent resending already successfully sent payslips
    if (payslip.emailSent && payslip.emailSentAt && !payslip.emailError) {
      console.warn(`Payslip ${payslipId} was already successfully sent at ${payslip.emailSentAt}. Skipping resend.`);
      return payslip;
    }

    try {
      const emailSent = await this.emailService.sendPayslip(
        payslip.employee.email,
        // Convert Prisma `Bytes` (Uint8Array) back to Node Buffer for Nodemailer
        Buffer.from(payslip.pdfContent as Uint8Array),
        payslip.fileName,
        `${payslip.employee.firstName} ${payslip.employee.lastName}`,
      );

      if (emailSent) {
        const updated = await this.prisma.payslip.update({
          omit: { pdfContent: true, filePath: true },
          where: { id: payslipId },
          data: {
            emailSent: true,
            emailSentAt: new Date(),
            emailError: null, // Clear any previous errors
          },
        });

        // Log successful resend
        if (userId) {
          await this.auditService.log({
            userId,
            action: 'PAYSLIP_RESENT',
            resource: 'payslip',
            resourceId: payslipId,
            details: {
              employeeId: payslip.employeeId,
              employeeEmail: payslip.employee.email,
              fileName: payslip.fileName,
            },
            status: 'success',
          });
        }

        return updated;
      }

      // Log failed resend
      if (userId) {
        await this.auditService.log({
          userId,
          action: 'PAYSLIP_RESENT',
          resource: 'payslip',
          resourceId: payslipId,
          details: {
            employeeId: payslip.employeeId,
            employeeEmail: payslip.employee.email,
            fileName: payslip.fileName,
          },
          status: 'failure',
          errorMessage: 'Failed to send email',
        });
      }

      return payslip;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log error
      if (userId) {
        await this.auditService.log({
          userId,
          action: 'PAYSLIP_RESENT',
          resource: 'payslip',
          resourceId: payslipId,
          details: {
            employeeId: payslip.employeeId,
            fileName: payslip.fileName,
          },
          status: 'failure',
          errorMessage,
        });
      }

      throw error;
    }
  }

  // ==================== BATCH MANAGEMENT METHODS ====================

  /**
   * Get all upload batches with pagination and filtering
   */
  async getBatches(page = 1, limit = 10, payMonth?: string, status?: string) {
    const take = limit;
    const skip = (page - 1 > 0) ? (page - 1) * limit : 0;

    const where: any = { deletedAt: null };
    if (payMonth) where.payMonth = payMonth;
    if (status) where.status = status;

    const [total, data] = await Promise.all([
      this.prisma.payslipUpload.count({ where }),
      this.prisma.payslipUpload.findMany({
        where,
        include: {
          _count: {
            select: { payslips: true },
          },
        },
        take,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take) || 0,
    };
  }

  /**
   * Get detailed information about a specific batch including payslips
   */
  async getBatchDetails(batchId: string) {
    const batch = await this.prisma.payslipUpload.findFirst({
      omit: { filePath: true, deletedAt: true },
      where: {
        OR: [
          { uuid: batchId },
          { id: isNaN(+batchId) ? -1 : +batchId },
        ],
        deletedAt: null,
      },
      include: {
        payslips: {
          omit: { pdfContent: true, filePath: true, deletedAt: true },
          where: { deletedAt: null },
          include: {
            employee: {
              select: {
                id: true,
                uuid: true,
                ippisNumber: true,
                firstName: true,
                lastName: true,
                email: true,
                department: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    return batch;
  }

  /**
   * Send all payslips in a batch via email
   * This can be called manually or by a cron job
   */
  async sendBatch(batchId: string, userId?: number) {
    const batch = await this.prisma.payslipUpload.findFirst({
      where: {
        OR: [
          { uuid: batchId },
          { id: isNaN(+batchId) ? -1 : +batchId },
        ],
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

    if (batch.status !== 'processed') {
      throw new Error(`Batch status is "${batch.status}". Only "processed" batches can be sent.`);
    }

    // Check if all payslips already sent successfully
    if (batch.payslips.length === 0) {
      console.log(`All payslips in batch ${batchId} have already been sent successfully.`);
      return {
        batchId: batch.uuid,
        payMonth: batch.payMonth,
        totalPayslips: 0,
        successCount: 0,
        failureCount: 0,
        emailStatus: 'completed',
        message: 'All payslips already sent',
        sentAt: batch.sentAt,
        completedAt: batch.completedAt,
      };
    }

    // Update batch status to sending
    await this.prisma.payslipUpload.update({
      where: { id: batch.id },
      data: {
        emailStatus: 'sending',
        sentAt: new Date(),
        updatedBy: userId,
      },
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
            console.log(`Payslip ${payslip.id} already sent successfully. Skipping.`);
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
          console.error(`Failed to send payslip ${payslip.id}:`, error);
        }
      }

      // Clear batch reference to allow garbage collection
      emailBatch.length = 0;

      // Add small delay between batches to prevent overwhelming the email server
      if (i + EMAIL_BATCH_SIZE < batch.payslips.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Clear payslips array reference
    batch.payslips.length = 0;

    // Determine final email status
    let emailStatus = 'completed';
    if (failureCount > 0 && successCount > 0) {
      emailStatus = 'partial';
    } else if (failureCount > 0 && successCount === 0) {
      emailStatus = 'failed';
    }

    // Update batch with final counts and status
    const updatedBatch = await this.prisma.payslipUpload.update({
      where: { id: batch.id },
      data: {
        status: 'completed',
        emailStatus,
        successCount,
        failureCount,
        completedAt: new Date(),
        updatedBy: userId,
      },
      include: {
        _count: {
          select: { payslips: true },
        },
      },
    });

    // Log audit
    if (userId) {
      await this.auditService.log({
        userId,
        action: 'PAYSLIP_BATCH_SENT',
        resource: 'payslip_upload',
        resourceId: batch.id,
        details: {
          batchId: batch.uuid,
          payMonth: batch.payMonth,
          totalPayslips: batch.payslips.length,
          successCount,
          failureCount,
          emailStatus,
        },
        status: emailStatus === 'failed' ? 'failure' : 'success',
      });
    }

    return {
      batchId: batch.uuid,
      payMonth: batch.payMonth,
      totalPayslips: successCount + failureCount + skippedCount,
      successCount,
      failureCount,
      skippedCount,
      emailStatus,
      sentAt: updatedBatch.sentAt,
      completedAt: updatedBatch.completedAt,
    };
  }

  /**
   * Get batches ready to be sent (status = 'processed', emailStatus = 'pending')
   */
  async getPendingBatches() {
    return this.prisma.payslipUpload.findMany({
      where: {
        status: 'processed',
        emailStatus: 'pending',
        deletedAt: null,
      },
      include: {
        _count: {
          select: { payslips: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
