import { DynamicModule, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { CacheService } from './cache.service';

export interface RedisModuleOptions {
  url: string;
}

@Module({})
export class RedisModule {
  static forRoot(options: RedisModuleOptions): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: 'REDIS_CLIENT',
          useFactory: () => {
            const client = new Redis(options.url);
            client.on('error', (err) => console.error('Redis error:', err));
            return client;
          },
        },
        CacheService,
      ],
      exports: ['REDIS_CLIENT', CacheService],
      global: true,
    };
  }
}
