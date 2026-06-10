import { HttpException, HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly redis: Redis;
  private readonly limit = 100;
  private readonly windowSeconds = 60;

  constructor(config: ConfigService) {
    this.redis = new Redis(config.get<string>('redis.url') ?? process.env.REDIS_URL ?? 'redis://localhost:6379');
  }

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    if (!this.shouldLimit(req)) {
      next();
      return;
    }

    const key = this.keyFor(req);
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, this.windowSeconds);
    }

    if (count > this.limit) {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    next();
  }

  private shouldLimit(req: Request): boolean {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return false;
    return req.path.startsWith('/auth') || req.path.startsWith('/api/ai');
  }

  private keyFor(req: Request): string {
    const sessionUser = (req as Request & { session?: Record<string, unknown> }).session?.['userId'];
    const identity = sessionUser ?? req.ip ?? 'unknown';
    return `rate:bff:${identity}:${req.method}:${req.path}`;
  }
}
