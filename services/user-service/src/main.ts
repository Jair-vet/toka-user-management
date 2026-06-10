import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('UserService');
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors({ origin: [process.env.FRONTEND_URL ?? 'http://localhost:5173'], credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const config = new DocumentBuilder().setTitle('User Service API').setVersion('1.0').addBearerAuth().build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  logger.log(`User Service running on port ${port}`);
}

bootstrap().catch((err) => {
  new Logger('UserService').error('Failed to start User Service', err);
  process.exit(1);
});
