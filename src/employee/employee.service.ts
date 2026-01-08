import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../auth/services/audit.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import * as xlsx from 'xlsx';
import { InjectQueue } from '@nestjs/bullmq';
import { REDIS_EMPLOYEE_QUEUE } from '@/constant';
import { Queue } from 'bullmq';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectQueue(REDIS_EMPLOYEE_QUEUE) private employeeQueue: Queue,
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(createEmployeeDto: CreateEmployeeDto, userId?: number) {
    const employee = await this.prisma.employee.create({
      data: createEmployeeDto,
    });

    if (userId) {
      await this.auditService.log({
        userId,
        action: 'EMPLOYEE_CREATED',
        resource: 'employee',
        resourceId: employee.id,
        details: {
          ippis: employee.ippisNumber,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
        },
        status: 'success',
      });
    }

    return employee;
  }

  async findAll(page = 0, limit = 10, search?: string) {
    const take = limit;
    const skip = (page-1>0)? (page-1) * limit : 0;
    const where: any ={
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { ippisNumber: { contains: search, mode: 'insensitive' } },
        ],
      })
    }

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where: { ...where, deletedAt: null },
        take,
        skip,
        orderBy: { id: 'asc' },
      }),
      this.prisma.employee.count({ where: { deletedAt: null } }),
    ]);
    return {
      data,
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take) || 0,
    };
  }

  async findOne(id: number) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      include: {
        payslips: true,
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    return employee;
  }

  async findByIppisNumber(ippisNumber: string) {
    return this.prisma.employee.findFirst({
      where: { ippisNumber, deletedAt: null },
      include: {
        payslips: true,
      },
    });
  }

  async update(id: number, updateEmployeeDto: UpdateEmployeeDto, userId?: number) {
    const oldEmployee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
    });

    const updatedEmployee = await this.prisma.employee.update({
      where: { id },
      data: updateEmployeeDto,
    });

    if (userId && oldEmployee) {
      // Detect changes
      const changes: Record<string, any> = {};
      for (const key of Object.keys(updateEmployeeDto)) {
        if (oldEmployee[key as keyof typeof oldEmployee] !== updateEmployeeDto[key as keyof UpdateEmployeeDto]) {
          changes[key] = {
            from: oldEmployee[key as keyof typeof oldEmployee],
            to: updateEmployeeDto[key as keyof UpdateEmployeeDto],
          };
        }
      }

      await this.auditService.log({
        userId,
        action: 'EMPLOYEE_UPDATED',
        resource: 'employee',
        resourceId: id,
        details: {
          changes,
          fieldsModified: Object.keys(updateEmployeeDto),
        },
        status: 'success',
      });
    }

    return updatedEmployee;
  }

  async remove(id: number, userId?: number) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
    });

    const deleted = await this.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    if (userId && employee) {
      await this.auditService.log({
        userId,
        action: 'EMPLOYEE_DELETED',
        resource: 'employee',
        resourceId: id,
        details: {
          firstName: employee.firstName,
          lastName: employee.lastName,
          ippis: employee.ippisNumber,
          email: employee.email,
        },
        status: 'success',
      });
    }

    return deleted;
  }

  /**
   * Restore a soft-deleted employee
   */
  async restore(id: number, userId?: number) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: { not: null } },
    });

    if (!employee) {
      throw new NotFoundException(`Deleted employee with ID ${id} not found`);
    }

    const restored = await this.prisma.restore('employee', { id });

    if (userId) {
      await this.auditService.log({
        userId,
        action: 'EMPLOYEE_RESTORED',
        resource: 'employee',
        resourceId: id,
        details: {
          firstName: employee.firstName,
          lastName: employee.lastName,
          ippis: employee.ippisNumber,
          email: employee.email,
        },
        status: 'success',
      });
    }

    return restored;
  }

  /**
   * Get all soft-deleted employees
   */
  async findDeleted(page = 1, limit = 10) {
    const take = limit;
    const skip = (page - 1 > 0) ? (page - 1) * limit : 0;

    const [data, total] = await Promise.all([
      this.prisma.findDeleted('employee', {
        take,
        skip,
        orderBy: { deletedAt: 'desc' },
      }),
      this.prisma.employee.count({ where: { deletedAt: { not: null } } }),
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
   * Generate Excel template for bulk employee upload
   */
  generateTemplate(): Buffer {
    const workbook = xlsx.utils.book_new();

    // Create sample data with headers
    const sampleData = [
      {
        'IPPIS Number': 'IPP123456',
        'First Name': 'John',
        'Last Name': 'Doe',
        'Email': 'john.doe@example.com',
        'Department': 'IT Department',
      },
      {
        'IPPIS Number': 'IPP123457',
        'First Name': 'Jane',
        'Last Name': 'Smith',
        'Email': 'jane.smith@example.com',
        'Department': 'Finance Department',
      },
    ];

    const worksheet = xlsx.utils.json_to_sheet(sampleData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // IPPIS Number
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name
      { wch: 30 }, // Email
      { wch: 20 }, // Department
    ];

    xlsx.utils.book_append_sheet(workbook, worksheet, 'Employees');

    // Generate buffer
    return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Bulk upload employees from Excel file
   * Adds the job to the queue for asynchronous processing
   */
  async bulkUpload(
    fileBuffer: Buffer,
    userId?: number,
  ): Promise<{ message: string; jobId: string }> {
    try {
      // Add job to queue
      const job = await this.employeeQueue.add('bulk-upload', {
        fileBuffer,
        userId,
      },
    {
      removeOnComplete: 5,
      removeOnFail: 5,
    });

      // Log initial audit entry
      if (userId) {
        await this.auditService.log({
          userId,
          action: 'EMPLOYEES_BULK_UPLOAD_STARTED',
          resource: 'employee',
          details: {
            jobId: job.id,
            status: 'queued',
          },
          status: 'success',
        });
      }

      return {
        message: 'Bulk upload job has been queued for processing',
        jobId: job.id as string,
      };
    } catch (error: any) {
      if (userId) {
        await this.auditService.log({
          userId,
          action: 'EMPLOYEES_BULK_UPLOAD_FAILED',
          resource: 'employee',
          details: { error: error.message },
          status: 'failure',
          errorMessage: error.message,
        });
      }

      throw new BadRequestException(
        `Failed to queue bulk upload: ${error.message}`,
      );
    }
  }

  /**
   * Get the status of a bulk upload job
   */
  async getBulkUploadStatus(jobId: string) {
    const job = await this.employeeQueue.getJob(jobId);

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
}