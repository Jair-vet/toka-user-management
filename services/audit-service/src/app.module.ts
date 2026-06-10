import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { TerminusModule } from '@nestjs/terminus';
import {
  CacheService,
  CorrelationIdInterceptor,
  JwtGuard,
  RabbitMQModule,
  RedisModule,
  RolesGuard,
} from '@toka/shared-kernel';
import { AuditEventSchemaClass, AuditEventSchema } from './infrastructure/persistence/mongoose/audit-event.schema';
import { AuditEventSubscriberService } from './infrastructure/messaging/audit-event.subscriber';
import { AuditApplicationService } from './application/use-cases/audit.application-service';
import { AuditController } from './presentation/controllers/audit.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow('MONGODB_URL'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([{ name: AuditEventSchemaClass.name, schema: AuditEventSchema }]),
    RabbitMQModule.forRoot({ url: process.env.RABBITMQ_URL ?? 'amqp://localhost:5672' }),
    RedisModule.forRoot({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' }),
    TerminusModule,
  ],
  controllers: [AuditController],
  providers: [
    AuditApplicationService,
    AuditEventSubscriberService,
    {
      provide: 'KEYCLOAK_JWKS_URI',
      useFactory: (config: ConfigService) =>
        `${config.getOrThrow('KEYCLOAK_URL')}/realms/${config.getOrThrow('KEYCLOAK_REALM')}/protocol/openid-connect/certs`,
      inject: [ConfigService],
    },
    {
      provide: 'KEYCLOAK_CLIENT_ID',
      useFactory: (config: ConfigService) => config.get('KEYCLOAK_CLIENT_ID') ?? 'backend-services',
      inject: [ConfigService],
    },
    { provide: APP_INTERCEPTOR, useClass: CorrelationIdInterceptor },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, cacheService: CacheService, jwksUri: string, clientId: string) =>
        new JwtGuard(reflector, cacheService, jwksUri, clientId),
      inject: [Reflector, CacheService, 'KEYCLOAK_JWKS_URI', 'KEYCLOAK_CLIENT_ID'],
    },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
