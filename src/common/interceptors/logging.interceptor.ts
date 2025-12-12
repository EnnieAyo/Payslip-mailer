import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = new Date();
    console.log('Before call...', now.toISOString());
    if (context.getType() === 'http') {
      console.log('Controller called: ', context.getClass());
      console.log('Function handling call: ', context.getHandler());
      // console.log( context.switchToHttp().getRequest().headers?.['user-agent'])
    }

    return next.handle().pipe(
      tap(() =>
        console.log(
          `After call...`,
          (new Date().getTime() - now.getTime())/1000 + ' seconds',
        ),
      ),
      catchError((error) => {
        console.error(
          `After error ...`,
          (new Date().getTime() - now.getTime())/1000 + ' seconds',
        );
        console.error(error);
        throw error;
      }),
    );
  }
}