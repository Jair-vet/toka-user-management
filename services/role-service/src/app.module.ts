import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminusModule } from '@nestjs/terminus';
import {
  CacheService,
  CorrelationIdInterceptor,
  JwtGuard,
  RabbitMQModule,
  RedisModule,
  RolesGuard,
} from '@toka/shared-kernel';
import { RoleOrmEntity } from './infrastructure/persistence/typeorm/role.orm-entity';
import { PermissionOrmEntity } from './infrastructure/persistence/typeorm/permission.orm-entity';
import { UserRoleOrmEntity } from './infrastructure/persistence/typeorm/user-role.orm-entity';
import { RoleApplicationService } from './application/use-cases/role.application-service';
import { RoleController } from './presentation/controllers/role.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow('DATABASE_URL'),
        entities: [RoleOrmEntity, PermissionOrmEntity, UserRoleOrmEntity],
        synchronize: false,
        logging: config.get('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([RoleOrmEntity, PermissionOrmEntity, UserRoleOrmEntity]),
    RabbitMQModule.forRoot({ url: process.env.RABBITMQ_URL ?? 'amqp://localhost:5672' }),
    RedisModule.forRoot({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' }),
    TerminusModule,
  ],
  controllers: [RoleController],
  providers: [
    RoleApplicationService,
    {
      provide: 'KEYCLOAK_JWKS_URI',
      useFactory: (config: ConfigService) =>
        `${config.getOrThrow('KEYCLOAK_URL')}/realms/${config.getOrThrow('KEYCLOAK_REALM')}/protocol/openid-connect/certs`,
      inject: [ConfigService],
    },
    {
      provide: 'KEYCLOAK_CLIENT_ID',
      useFactory: (config: ConfigService) => config.getOrThrow('KEYCLOAK_CLIENT_ID', { infer: true }) ?? 'backend-services',
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
