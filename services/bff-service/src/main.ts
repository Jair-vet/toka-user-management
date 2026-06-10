import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import csrf from 'csurf';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('BFF');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 3005;
  const corsOrigins = config.get<string[]>('cors.origins') ?? ['http://localhost:5173'];
  const sessionSecret = config.get<string>('sessionSecret') ?? 'secret';
  const cookieSecure = config.get<boolean>('cookieSecure') ?? false;

  // Security
  app.use(helmet());
  app.use(cookieParser());
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: cookieSecure,
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000, // 8h
      },
    }),
  );
  app.use(csrf());

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Correlation-Id'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Toka BFF')
    .setDescription('Backend-for-Frontend aggregation layer')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api-docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(port);
  logger.log(`BFF running on port ${port}`);
}

bootstrap().catch((err) => {
  new Logger('BFF').error('Failed to start BFF', err);
  process.exit(1);
});
