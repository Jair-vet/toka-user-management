import { Module } from '@nestjs/common';
import { CorrelationIdInterceptor } from './correlation-id.interceptor';

@Module({
  providers: [CorrelationIdInterceptor],
  exports: [CorrelationIdInterceptor],
})
export class LoggerModule {}
