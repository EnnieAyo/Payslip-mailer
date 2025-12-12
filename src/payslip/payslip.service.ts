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

  async uploadAndDistribute(pdfBuffer: Buffer, fileName: string) {
    const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create upload record
    const upload = await this.prisma.payslipUpload.create({
      data: {
        fileName,
        filePath: `uploads/${uploadId}`,
        totalFiles: 1,
        status: 'processing',
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

      let successCount = 0;
      let failureCount = 0;

      // Process each payslip
      for (const payslip of payslipsInputs) {
        const employee = await this.employeeService.findByIppisNumber(
          payslip.ippisNumber || 'IPPIS4536',
        );

        if (!employee) {
          console.warn(
            `Employee with IPPIS number ${payslip.ippisNumber} not found`,
          );
          failureCount++;
          continue;
        }

        // Save payslip to database
        const savedPayslip = await this.prisma.payslip.create({
          data: {
            ippisNumber: payslip.ippisNumber||'',
            fileName: `${payslip.ippisNumber}-${fileName}`,
            filePath: await this.pdfService.savePdfFile(
              payslip.pdfBuffer,
              `${payslip.ippisNumber}.pdf`,
              uploadId,
            ),
            // Prisma `Bytes` maps to `Uint8Array` — convert Node Buffer to Uint8Array
            pdfContent: new Uint8Array(payslip.pdfBuffer),
            employeeId: employee.id,
          },
        });

        // Send email
        const emailSent = await this.emailService.sendPayslip(
          employee.email,
          payslip.pdfBuffer,
          `${employee.firstName}_${employee.lastName}_Payslip.pdf`,
          `${employee.firstName} ${employee.lastName}`,
        );

        if (emailSent) {
          await this.prisma.payslip.update({
            where: { id: savedPayslip.id },
            data: {
              emailSent: true,
              emailSentAt: new Date(),
            },
          });
          successCount++;
        } else {
          failureCount++;
        }
      }

      // Update upload status
      await this.prisma.payslipUpload.update({
        where: { id: upload.id },
        data: {
          status: 'completed',
          successCount,
          failureCount,
          totalFiles: successCount + failureCount,
        },
      });

      return {
        uploadId,
        successCount,
        failureCount,
        totalFiles: successCount + failureCount,
      };
    } catch (error) {
      // Update upload status to failed
      await this.prisma.payslipUpload.update({
        where: { id: upload.id },
        data: {
          status: 'failed',
        },
      });

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
    const skip = page * limit;

    const [total, data] = await Promise.all([
      this.prisma.payslip.count({ where: { employeeId } }),
      this.prisma.payslip.findMany({
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
    const skip = page * limit;

    const [total, data] = await Promise.all([
      this.prisma.payslip.count({ where: { emailSent: false } }),
      this.prisma.payslip.findMany({
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
          where: { id: payslipId },
          data: {
            emailSent: true,
            emailSentAt: new Date(),
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
}
