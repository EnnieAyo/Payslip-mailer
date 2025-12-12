import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const r: any = res;
        if (r.message) {
          message = Array.isArray(r.message) ? r.message.join('; ') : String(r.message);
        } else if (r.error) {
          message = String(r.error);
        }
        details = r;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const payload = {
      success: false,
      message,
      data: null,
      meta: null,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(payload);
  }
}
