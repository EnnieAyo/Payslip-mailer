import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../auth/services/audit.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { BulkEmployeeDto, BulkUploadResultDto } from './dto/bulk-upload.dto';
import * as xlsx from 'xlsx';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

@Injectable()
export class EmployeeService {
  constructor(
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

  async findAll(page = 0, limit = 10) {
    const take = limit;
    const skip = (page-1>0)? (page-1) * limit : 0;

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where: { deletedAt: null },
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
   */
  async bulkUpload(
    fileBuffer: Buffer,
    userId?: number,
  ): Promise<BulkUploadResultDto> {
    const startTime = Date.now();
    const errors: Array<{ row: number; ippisNumber?: string; errors: string[] }> = [];
    let successCount = 0;
    let failureCount = 0;

    try {
      // Parse Excel file
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      
      if (!sheetName) {
        throw new BadRequestException('Excel file has no sheets');
      }

      const worksheet = workbook.Sheets[sheetName];
      const rawData: any[] = xlsx.utils.sheet_to_json(worksheet);

      if (!rawData || rawData.length === 0) {
        throw new BadRequestException('Excel file is empty');
      }

      const totalRecords = rawData.length;

      // Process each row
      for (let i = 0; i < rawData.length; i++) {
        const rowNumber = i + 2; // Excel row number (header is row 1)
        const row = rawData[i];

        try {
          // Map Excel columns to DTO
          const employeeDto = plainToClass(BulkEmployeeDto, {
            ippisNumber: row['IPPIS Number']?.toString().trim(),
            firstName: row['First Name']?.toString().trim(),
            lastName: row['Last Name']?.toString().trim(),
            email: row['Email']?.toString().trim(),
            department: row['Department']?.toString().trim(),
          });

          // Validate DTO
          const validationErrors = await validate(employeeDto);
          
          if (validationErrors.length > 0) {
            const errorMessages = validationErrors.map(
              (error) => Object.values(error.constraints || {}).join(', '),
            );
            
            errors.push({
              row: rowNumber,
              ippisNumber: row['IPPIS Number'],
              errors: errorMessages,
            });
            failureCount++;
            continue;
          }

          // Check for duplicate IPPIS number in database
          const existingEmployee = await this.prisma.employee.findFirst({
            where: { 
              ippisNumber: employeeDto.ippisNumber,
              deletedAt: null,
            },
          });

          if (existingEmployee) {
            errors.push({
              row: rowNumber,
              ippisNumber: employeeDto.ippisNumber,
              errors: [`Employee with IPPIS ${employeeDto.ippisNumber} already exists`],
            });
            failureCount++;
            continue;
          }

          // Check for duplicate email in database
          const existingEmail = await this.prisma.employee.findFirst({
            where: { 
              email: employeeDto.email,
              deletedAt: null,
            },
          });

          if (existingEmail) {
            errors.push({
              row: rowNumber,
              ippisNumber: employeeDto.ippisNumber,
              errors: [`Email ${employeeDto.email} is already registered`],
            });
            failureCount++;
            continue;
          }

          // Create employee
          await this.prisma.employee.create({
            data: {
              ippisNumber: employeeDto.ippisNumber,
              firstName: employeeDto.firstName,
              lastName: employeeDto.lastName,
              email: employeeDto.email,
              department: employeeDto.department,
              createdBy: userId,
            },
          });

          successCount++;
        } catch (error: any) {
          errors.push({
            row: rowNumber,
            ippisNumber: row['IPPIS Number'],
            errors: [error.message || 'Unknown error occurred'],
          });
          failureCount++;
        }
      }

      const processingTime = (Date.now() - startTime)/1000; // in seconds

      // Log audit trail
      if (userId) {
        await this.auditService.log({
          userId,
          action: 'EMPLOYEES_BULK_UPLOAD',
          resource: 'employee',
          details: {
            totalRecords,
            successCount,
            failureCount,
            processingTime: processingTime + 's',
            hasErrors: failureCount > 0,
          },
          status: failureCount === totalRecords ? 'failure' : 'success',
        });
      }

      return {
        totalRecords,
        successCount,
        failureCount,
        errors,
        processingTime,
      };
    } catch (error: any) {
      // Log error
      if (userId) {
        await this.auditService.log({
          userId,
          action: 'EMPLOYEES_BULK_UPLOAD',
          resource: 'employee',
          details: { error: error.message },
          status: 'failure',
          errorMessage: error.message,
        });
      }

      throw new BadRequestException(
        `Failed to process Excel file: ${error.message}`,
      );
    };
  }
}