import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PdfService } from '../pdf/pdf.service';
import { EmployeeService } from '../employee/employee.service';
import { AuditService } from '../auth/services/audit.service';
import { InjectQueue } from '@nestjs/bullmq';
import { REDIS_PAYSILP_QUEUE } from '@/constant';
import { Queue } from 'bullmq';

@Injectable()
export class PayslipService {
  constructor(
    @InjectQueue(REDIS_PAYSILP_QUEUE) private payslipQueue: Queue,
    private prisma: PrismaService,
    private emailService: EmailService,
    private auditService: AuditService,
  ) {}

  /**
   * Queue payslip upload for background processing
   */
  async uploadAndProcess(pdfBuffer: Buffer, fileName: string, payMonth: string, userId?: number) {
    try {
      const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create upload record
      const upload = await this.prisma.payslipUpload.create({
        data: {
          fileName,
          filePath: `uploads/${uploadId}`,
          payMonth,
          totalFiles: 0, // Will be updated by consumer
          status: 'queued',
          emailStatus: 'pending',
          createdBy: userId,
        },
      });

      // Add job to queue
      const job = await this.payslipQueue.add('payslip-upload', {
        pdfBuffer,
        fileName,
        payMonth,
        userId,
        uploadId: upload.id,
      },
      {
        removeOnComplete: 1,
        removeOnFail: 1,
      });

      // Log initial audit entry
      if (userId) {
        await this.auditService.log({
          userId,
          action: 'PAYSLIP_BATCH_UPLOADED_STARTED',
          resource: 'payslip_upload',
          resourceId: upload.id,
          details: {
            jobId: job.id,
            fileName,
            payMonth,
            status: 'queued',
          },
          status: 'success',
        });
      }

      return {
        message: 'Payslip upload job has been queued for processing',
        uploadId: upload.id,
        batchId: upload.uuid,
        jobId: job.id as string,
        payMonth,
      };
    } catch (error: any) {
      if (userId) {
        await this.auditService.log({
          userId,
          action: 'PAYSLIP_BATCH_UPLOADED_FAILED',
          resource: 'payslip_upload',
          details: {
            fileName,
            payMonth,
            error: error.message,
          },
          status: 'failure',
          errorMessage: error.message,
        });
      }

      throw new BadRequestException(
        `Failed to queue payslip upload: ${error.message}`,
      );
    }
  }

  /**
   * Get the status of a payslip upload job
   */
  async getUploadJobStatus(jobId: string) {
    const job = await this.payslipQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    const state = await job.getState();
    const progress = job.progress;
    const returnValue = job.returnvalue;

    return {
      jobId: job.id,
      state,
      progress,
      result: returnValue,
      createdAt: job.timestamp,
      processedAt: job.processedOn,
      finishedAt: job.finishedOn,
      failedReason: job.failedReason,
    };
  }
  
  async getSummary(){
    const totalPayslips = await this.prisma.payslip.count({});
    const sentPayslips = await this.prisma.payslip.count({where:{emailSent:true}});
    const pendingPayslips = await this.prisma.payslip.count({where:{emailSent:false}});
    return {
      totalPayslips,
      sentPayslips,
      pendingPayslips,
    };
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
   * Queue batch sending for background processing
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
        _count: {
          select: { payslips: true },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    if (batch.status !== 'processed') {
      throw new BadRequestException(
        `Batch status is "${batch.status}". Only "processed" batches can be sent.`,
      );
    }

    if (batch.emailStatus === 'sending') {
      throw new BadRequestException(
        'Batch is already being sent. Please wait for the current operation to complete.',
      );
    }

    try {
      // Add job to queue
      const job = await this.payslipQueue.add(
        'payslip-send',
        {
          batchId: batch.id,
          batchUuid: batch.uuid,
          userId,
        },
        {
          removeOnComplete: 1,
          removeOnFail: 1,
        },
      );

      // Update batch status to sending
      await this.prisma.payslipUpload.update({
        where: { id: batch.id },
        data: {
          emailStatus: 'sending',
          sentAt: new Date(),
          updatedBy: userId,
        },
      });

      // Log initial audit entry
      if (userId) {
        await this.auditService.log({
          userId,
          action: 'PAYSLIP_BATCH_SEND_STARTED',
          resource: 'payslip_upload',
          resourceId: batch.id,
          details: {
            jobId: job.id,
            batchId: batch.uuid,
            payMonth: batch.payMonth,
            totalPayslips: batch._count.payslips,
            status: 'queued',
          },
          status: 'success',
        });
      }

      return {
        message: 'Batch send job has been queued for processing',
        batchId: batch.uuid,
        jobId: job.id as string,
        payMonth: batch.payMonth,
        totalPayslips: batch._count.payslips,
      };
    } catch (error: any) {
      if (userId) {
        await this.auditService.log({
          userId,
          action: 'PAYSLIP_BATCH_SEND_FAILED',
          resource: 'payslip_upload',
          resourceId: batch.id,
          details: {
            batchId: batch.uuid,
            error: error.message,
          },
          status: 'failure',
          errorMessage: error.message,
        });
      }

      throw new BadRequestException(
        `Failed to queue batch send: ${error.message}`,
      );
    }
  }

  /**
   * Get the status of a batch send job
   */
  async getBatchSendJobStatus(jobId: string) {
    const job = await this.payslipQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    const state = await job.getState();
    const progress = job.progress;
    const returnValue = job.returnvalue;

    return {
      jobId: job.id,
      state,
      progress,
      result: returnValue,
      createdAt: job.timestamp,
      processedAt: job.processedOn,
      finishedAt: job.finishedOn,
      failedReason: job.failedReason,
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
