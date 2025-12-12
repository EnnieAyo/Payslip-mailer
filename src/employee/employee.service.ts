import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../auth/services/audit.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

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

  async findAll() {
    return this.prisma.employee.findMany({
      include: {
        payslips: true,
      },
    });
  }

  async findOne(id: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
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
    return this.prisma.employee.findUnique({
      where: { ippisNumber },
      include: {
        payslips: true,
      },
    });
  }

  async update(id: number, updateEmployeeDto: UpdateEmployeeDto, userId?: number) {
    const oldEmployee = await this.prisma.employee.findUnique({
      where: { id },
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
    const employee = await this.prisma.employee.findUnique({
      where: { id },
    });

    const deleted = await this.prisma.employee.delete({
      where: { id },
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
}
