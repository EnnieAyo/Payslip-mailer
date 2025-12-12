import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuditService } from '../../auth/services/audit.service';
import { Request, Response } from 'express';

interface AuditableEndpoint {
  path: string;
  action: string;
  resource?: string;
  extractResourceId?: (body: any, params: any) => number | undefined;
  extractDetails?: (body: any, params: any, response?: any) => Record<string, any>;
}

/**
 * Maps request paths/methods to audit-relevant information
 * This allows customization of what gets logged and how
 */
const AUDITABLE_ENDPOINTS: AuditableEndpoint[] = [
  // Authentication endpoints
  {
    path: 'auth/register',
    action: 'USER_REGISTERED',
    resource: 'user',
    extractDetails: (body) => ({
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
    }),
  },
  {
    path: 'auth/login',
    action: 'LOGIN',
    resource: 'auth',
    extractDetails: (body) => ({
      email: body.email,
    }),
  },
  {
    path: 'auth/forgot-password',
    action: 'PASSWORD_RESET_REQUESTED',
    resource: 'user',
    extractDetails: (body) => ({
      email: body.email,
    }),
  },
  {
    path: 'auth/reset-password-with-token',
    action: 'PASSWORD_RESET',
    resource: 'user',
    extractDetails: () => ({
      resetMethod: 'token',
    }),
  },
  {
    path: 'auth/reset-password',
    action: 'PASSWORD_RESET',
    resource: 'user',
    extractResourceId: (body) => body.userId,
    extractDetails: (body) => ({
      resetMethod: 'admin',
      targetUserId: body.userId,
    }),
  },
  {
    path: 'auth/unlock',
    action: 'USER_UNLOCKED',
    resource: 'user',
    extractResourceId: (body) => body.userId,
    extractDetails: (body) => ({
      unlockedUserId: body.userId,
    }),
  },

  // Employee endpoints
  {
    path: 'employees',
    action: 'EMPLOYEE_CREATED',
    resource: 'employee',
    extractDetails: (body) => ({
      ippis: body.ippis,
      name: body.name,
      email: body.email,
      department: body.department,
    }),
  },
  {
    path: 'employees/:id',
    action: 'EMPLOYEE_UPDATED',
    resource: 'employee',
    extractResourceId: (body, params) => parseInt(params.id, 10),
    extractDetails: (body) => ({
      updates: Object.keys(body),
    }),
  },
  {
    path: 'employees/:id',
    action: 'EMPLOYEE_DELETED',
    resource: 'employee',
    extractResourceId: (body, params) => parseInt(params.id, 10),
    extractDetails: (body, params) => ({
      deletedEmployeeId: params.id,
    }),
  },

  // Payslip endpoints
  {
    path: 'payslips/upload',
    action: 'PAYSLIP_UPLOADED',
    resource: 'payslip',
    extractDetails: (body, params, response) => ({
      fileName: response?.fileName || 'unknown',
      fileSize: response?.fileSize || 0,
      uploadId: response?.uploadId,
      ippisCount: response?.payslips?.length || 0,
    }),
  },
  {
    path: 'payslips/upload/:uploadId',
    action: 'PAYSLIP_STATUS_CHECKED',
    resource: 'payslip',
    extractResourceId: (body, params) => {
      const uploadId = params.uploadId;
      return uploadId ? parseInt(uploadId.replace(/\D/g, '') || '0', 10) : undefined;
    },
    extractDetails: (body, params) => ({
      uploadId: params.uploadId,
    }),
  },
  {
    path: 'payslips/employee/:employeeId',
    action: 'PAYSLIPS_RETRIEVED',
    resource: 'payslip',
    extractResourceId: (body, params) => parseInt(params.employeeId, 10),
    extractDetails: (body, params) => ({
      employeeId: params.employeeId,
    }),
  },
  {
    path: 'payslips/unsent',
    action: 'UNSENT_PAYSLIPS_RETRIEVED',
    resource: 'payslip',
    extractDetails: (body, params, response) => ({
      count: Array.isArray(response) ? response.length : 0,
    }),
  },
];

/**
 * HTTP Request/Response Interceptor for Audit Logging
 * 
 * This interceptor:
 * 1. Logs all auditable requests before they reach the handler
 * 2. Captures response data and status codes
 * 3. Logs failures with error messages
 * 4. Extracts client IP and user agent
 * 5. Associates logs with authenticated users
 */
@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const method = request.method;
    const url = request.url;
    const path = request.path;
    const body = request.body;
    const params = (request as any).params || {};
    const user = (request as any).user;

    // Find matching auditable endpoint
    const auditConfig = this.findAuditConfig(method, path);

    // If not an auditable endpoint, just pass through
    if (!auditConfig) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap((responseData) => {
        // Log successful request
        this.logAuditEvent({
          user,
          auditConfig,
          body,
          params,
          responseData,
          request,
          statusCode: response.statusCode,
          status: 'success',
          error: null,
        });
      }),
      catchError((error) => {
        // Log failed request
        this.logAuditEvent({
          user,
          auditConfig,
          body,
          params,
          responseData: null,
          request,
          statusCode: error.getStatus ? error.getStatus() : 500,
          status: 'failure',
          error,
        });

        // Re-throw the error
        throw error;
      }),
    );
  }

  /**
   * Finds the audit configuration for a given HTTP method and path
   */
  private findAuditConfig(method: string, path: string): AuditableEndpoint | null {
    // Only audit POST, PUT, DELETE, and certain GET endpoints
    const auditableMethods = ['POST', 'PUT', 'DELETE', 'GET'];
    if (!auditableMethods.includes(method)) {
      return null;
    }

    for (const config of AUDITABLE_ENDPOINTS) {
      if (this.pathMatches(path, config.path)) {
        return config;
      }
    }

    return null;
  }

  /**
   * Checks if a request path matches a config pattern
   * Handles both exact matches and parameterized routes
   */
  private pathMatches(requestPath: string, configPath: string): boolean {
    // Remove leading/trailing slashes and split
    const requestParts = requestPath.split('/').filter((p) => p);
    const configParts = configPath.split('/').filter((p) => p);

    if (requestParts.length !== configParts.length) {
      return false;
    }

    for (let i = 0; i < configParts.length; i++) {
      const configPart = configParts[i];
      const requestPart = requestParts[i];

      // If config part is a parameter (starts with :), it matches anything
      if (!configPart.startsWith(':') && configPart !== requestPart) {
        return false;
      }
    }

    return true;
  }

  /**
   * Logs an audit event with proper error handling
   */
  private async logAuditEvent(options: {
    user: any;
    auditConfig: AuditableEndpoint;
    body: any;
    params: any;
    responseData: any;
    request: Request;
    statusCode: number;
    status: 'success' | 'failure';
    error: any;
  }): Promise<void> {
    const {
      user,
      auditConfig,
      body,
      params,
      responseData,
      request,
      statusCode,
      status,
      error,
    } = options;

    try {
      // Extract resource ID if custom extractor provided
      const resourceId = auditConfig.extractResourceId
        ? auditConfig.extractResourceId(body, params)
        : undefined;

      // Extract details if custom extractor provided
      const details = auditConfig.extractDetails
        ? auditConfig.extractDetails(body, params, responseData)
        : {};

      // Only log if user is authenticated OR it's a public endpoint (auth)
      const userId = user?.id;
      const isPublicEndpoint = auditConfig.action.includes('LOGIN') ||
        auditConfig.action.includes('REGISTER') ||
        auditConfig.action.includes('PASSWORD_RESET');

      if (!userId && !isPublicEndpoint) {
        // Don't log unauthenticated access to protected endpoints
        // (they would have been rejected by guards)
        return;
      }

      // Build audit log
      await this.auditService.log({
        userId: userId || undefined,
        action: auditConfig.action,
        resource: auditConfig.resource,
        resourceId,
        details: {
          ...details,
          statusCode,
          method: request.method,
          url: request.url,
        },
        ipAddress: this.getClientIp(request),
        userAgent: request.headers['user-agent'],
        status: status,
        errorMessage: error ? error.message : undefined,
      });
    } catch (logError) {
      // Silently fail if audit logging fails to avoid breaking the request
      console.error('Failed to write audit log:', logError);
    }
  }

  /**
   * Extracts client IP from request
   * Handles proxies and load balancers
   */
  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return (
      request.headers['x-real-ip'] ||
      request.socket.remoteAddress ||
      'unknown'
    ) as string;
  }
}
