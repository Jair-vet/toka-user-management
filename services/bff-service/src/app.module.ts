import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { configuration } from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { ProxyModule } from './proxy/proxy.module';
import { HealthController } from './health/health.controller';
import { RateLimitMiddleware } from './security/rate-limit.middleware';
// Note: @nestjs/axios provides HttpHealthIndicator for terminus

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TerminusModule,
    HttpModule,
    AuthModule,
    ProxyModule,
  ],
  controllers: [HealthController],
  providers: [RateLimitMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimitMiddleware).forRoutes('*');
  }
}
