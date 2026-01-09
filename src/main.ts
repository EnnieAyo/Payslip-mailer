import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ApiKeyGuard } from './auth/guards/api-key-guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Disable x-powered-by header
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.disable('x-powered-by');

  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.use(helmet());

  app.useGlobalGuards(new ApiKeyGuard());

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Payslip Mailer API')
    .setDescription('API for uploading and distributing payslips')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
