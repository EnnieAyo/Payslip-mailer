import { REDIS_EMPLOYEE_QUEUE } from "@/constant";
import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Job } from "bullmq";
import * as xlsx from 'xlsx';
import { BulkEmployeeDto } from "./dto/bulk-upload.dto";
import { plainToClass } from "class-transformer";
import { validate } from "class-validator";
import { AuditService } from "@/auth/services/audit.service";
import { PrismaService } from "@/prisma/prisma.service";
import { Logger } from "@nestjs/common";

@Processor(REDIS_EMPLOYEE_QUEUE, {
  concurrency: 2, // Process 2 jobs at a time
  limiter: {
    max: 10, // Max 10 jobs
    duration: 60000, // per 60 seconds
  },
})
export class EmployeeQueueConsumer extends WorkerHost {
    private readonly logger = new Logger(EmployeeQueueConsumer.name);

    constructor(
        private prisma: PrismaService,
        private auditService: AuditService,
    ){
        super();
    }

    async process(job: Job<any, any, string>) {
        this.logger.log(`Processing job ${job.id} of type ${job.name}`);

        try {
            if (job.name === 'bulk-upload') {
                const result = await this.processBulkUpload(job);
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

    async processBulkUpload(job: Job<{ fileBuffer: Buffer; userId: number }>) {
        const { fileBuffer, userId } = job.data;
        this.logger.log(`Processing Bulk Upload Job ${job.id} from user: ${userId}`);

        const startTime = Date.now();
        const errors: Array<{ row: number; ippisNumber?: string; errors: string[] }> = [];
        let successCount = 0;
        let failureCount = 0;

        try {
            // Convert fileBuffer to proper Buffer if it was serialized from Redis
            const buffer = Buffer.isBuffer(fileBuffer) 
                ? fileBuffer 
                : Buffer.from((fileBuffer as any).data);

            // Parse Excel file
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];

            if (!sheetName) {
                throw new Error('Excel file has no sheets');
            }

            const worksheet = workbook.Sheets[sheetName];
            const rawData: any[] = xlsx.utils.sheet_to_json(worksheet);

            if (!rawData || rawData.length === 0) {
                throw new Error('Excel file is empty');
            }

            const totalRecords = rawData.length;

            // Update progress: 0% - file parsed
            await job.updateProgress({
                stage: 'parsing',
                processed: 0,
                total: totalRecords,
                percentage: 0,
            });

            // Process each row
            for (let i = 0; i < rawData.length; i++) {
                const rowNumber = i + 2; // Excel row number (header is row 1)
                const row = rawData[i];

                // Update progress every 10 records or on last record
                if (i % 10 === 0 || i === rawData.length - 1) {
                    const percentage = Math.round((i / totalRecords) * 100);
                    await job.updateProgress({
                        stage: 'processing',
                        processed: i,
                        total: totalRecords,
                        percentage,
                        successCount,
                        failureCount,
                    });
                }

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

            const processingTime = (Date.now() - startTime) / 1000; // in seconds

            // Update final progress
            await job.updateProgress({
                stage: 'completed',
                processed: totalRecords,
                total: totalRecords,
                percentage: 100,
                successCount,
                failureCount,
            });

            // Log audit trail
            if (userId) {
                await this.auditService.log({
                    userId,
                    action: 'EMPLOYEES_BULK_UPLOAD_COMPLETED',
                    resource: 'employee',
                    details: {
                        jobId: job.id,
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
            this.logger.error(`Bulk upload failed: ${error.message}`, error.stack);

            // Log error
            if (userId) {
                await this.auditService.log({
                    userId,
                    action: 'EMPLOYEES_BULK_UPLOAD_FAILED',
                    resource: 'employee',
                    details: {
                        jobId: job.id,
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