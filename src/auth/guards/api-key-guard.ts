import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor() {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    if (!apiKey) {
      throw new UnauthorizedException('x-api-key header is missing');
    }

    const isValidApiKey = apiKey === process.env.API_KEY;

    if (!isValidApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }

}