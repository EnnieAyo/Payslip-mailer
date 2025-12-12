import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

type AnyObject = Record<string, any> | any[] | null;

@Injectable()
export class ResponseWrapperInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method: string = (req?.method || 'GET').toUpperCase();
    const url: string = req?.originalUrl || req?.url || '';

    const timestampNow = () => new Date().toISOString();

    const deriveMessage = (method: string, url: string, payload: any): string => {
      const path = url.split('?')[0];
      // normalize
      const parts = path.replace(/^\/+|\/+$/g, '').split('/');

      // helpful short-circuits
      if (/^\/auth\//.test(path)) return 'Authentication operation completed';

      // resources mapping
      const resource = parts[0] || '';
      const hasIdSegment = parts.length > 1 && /^\d+$/.test(parts[1]);

      if (method === 'GET') {
        if (resource === 'employees') {
          return hasIdSegment ? 'Employee retrieved' : 'Employees retrieved';
        }
        if (resource === 'payslips') {
          if (parts[1] === 'employee') return 'Payslips retrieved';
          if (parts[1] === 'unsent') return 'Unsent payslips retrieved';
          if (parts[1] === 'upload') return parts.length > 2 ? 'Payslip upload status retrieved' : 'Payslip uploads retrieved';
          return 'Payslips retrieved';
        }
        if (resource === 'audit') return 'Audit logs retrieved';
        return Array.isArray(payload) ? `${payload.length} items returned` : 'Retrieved';
      }

      if (method === 'POST') {
        if (resource === 'employees') return 'Employee created';
        if (resource === 'payslips' && parts[1] === 'upload') return 'Payslips uploaded';
        if (resource === 'payslips' && parts[1] === 'resend') return 'Payslip resent';
        return 'Created';
      }

      if (method === 'PUT' || method === 'PATCH') {
        if (resource === 'employees') return 'Employee updated';
        return 'Updated';
      }

      if (method === 'DELETE') {
        if (resource === 'employees') return 'Employee deleted';
        return 'Deleted';
      }

      return 'OK';
    };

    return next.handle().pipe(
      map((original) => {
        // If already wrapped, return as-is
        if (original && typeof original === 'object' && Object.prototype.hasOwnProperty.call(original, 'success')) {
          return original;
        }

        // Standard pagination shape used in services
        const isPaginated = original && typeof original === 'object' && Object.prototype.hasOwnProperty.call(original, 'data') && Object.prototype.hasOwnProperty.call(original, 'total');

        const timestamp = timestampNow();

        if (isPaginated) {
          const { data, total, page, limit, totalPages, ...rest } = original as any;
          return {
            success: true,
            message: deriveMessage(method, url, data),
            data: data || [],
            meta: {
              total: typeof total === 'number' ? total : 0,
              page: typeof page === 'number' ? page : 0,
              limit: typeof limit === 'number' ? limit : (Array.isArray(data) ? data.length : 0),
              totalPages: typeof totalPages === 'number' ? totalPages : 0,
              ...rest,
            },
            timestamp,
          };
        }

        // For single objects or arrays
        const payload: AnyObject = original === undefined ? null : original;

        return {
          success: true,
          message: deriveMessage(method, url, payload),
          data: payload,
          meta: null,
          timestamp,
        };
      }),
    );
  }
}
