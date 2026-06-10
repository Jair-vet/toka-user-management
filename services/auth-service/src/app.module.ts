import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import {
  CacheService,
  CorrelationIdInterceptor,
  JwtGuard,
  RabbitMQModule,
  RedisModule,
  RolesGuard,
} from '@toka/shared-kernel';
import { KeycloakAdapter } from './infrastructure/keycloak/keycloak.adapter';
import { AuthApplicationService } from './application/use-cases/auth.application-service';
import { AuthController } from './presentation/controllers/auth.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RabbitMQModule.forRoot({
      url: process.env.RABBITMQ_URL ?? 'amqp://localhost:5672',
    }),
    RedisModule.forRoot({
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    }),
    TerminusModule,
  ],
  controllers: [AuthController],
  providers: [
    KeycloakAdapter,
    AuthApplicationService,
    {
      provide: 'KEYCLOAK_JWKS_URI',
      useFactory: (config: ConfigService) =>
        `${config.getOrThrow('KEYCLOAK_URL')}/realms/${config.getOrThrow('KEYCLOAK_REALM')}/protocol/openid-connect/certs`,
      inject: [ConfigService],
    },
    {
      provide: 'KEYCLOAK_CLIENT_ID',
      useFactory: (config: ConfigService) => config.getOrThrow('KEYCLOAK_CLIENT_ID'),
      inject: [ConfigService],
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationIdInterceptor,
    },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, cacheService: CacheService, jwksUri: string, clientId: string) =>
        new JwtGuard(reflector, cacheService, jwksUri, clientId),
      inject: [Reflector, CacheService, 'KEYCLOAK_JWKS_URI', 'KEYCLOAK_CLIENT_ID'],
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
