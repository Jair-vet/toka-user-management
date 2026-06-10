import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('RoleService');
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({ origin: [process.env.FRONTEND_URL ?? 'http://localhost:5173'], credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Role Service API')
    .setDescription('RBAC role and permission management')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT ?? 3003;
  await app.listen(port);
  logger.log(`Role Service running on port ${port}`);
}

bootstrap().catch((err) => {
  new Logger('RoleService').error('Failed to start Role Service', err);
  process.exit(1);
});
