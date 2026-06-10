import { HttpException, HttpStatus } from '@nestjs/common';
import Redis from 'ioredis';
import { RateLimitMiddleware } from './rate-limit.middleware';

jest.mock('ioredis', () => jest.fn());

describe('RateLimitMiddleware', () => {
  const redisMock = {
    incr: jest.fn(),
    expire: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (Redis as unknown as jest.Mock).mockImplementation(() => redisMock);
  });

  it('skips safe HTTP methods', async () => {
    const middleware = new RateLimitMiddleware({ get: jest.fn() } as never);
    const next = jest.fn();

    await middleware.use({ method: 'GET', path: '/api/ai/chat', ip: '127.0.0.1' } as never, {} as never, next);

    expect(redisMock.incr).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('increments mutating AI requests and sets expiry for the first hit', async () => {
    redisMock.incr.mockResolvedValue(1);
    const middleware = new RateLimitMiddleware({ get: jest.fn().mockReturnValue('redis://redis:6379') } as never);
    const next = jest.fn();

    await middleware.use(
      { method: 'POST', path: '/api/ai/chat', ip: '127.0.0.1', session: { userId: 'user-1' } } as never,
      {} as never,
      next,
    );

    expect(redisMock.incr).toHaveBeenCalledWith('rate:bff:user-1:POST:/api/ai/chat');
    expect(redisMock.expire).toHaveBeenCalledWith('rate:bff:user-1:POST:/api/ai/chat', 60);
    expect(next).toHaveBeenCalled();
  });

  it('throws 429 when the request exceeds the limit', async () => {
    redisMock.incr.mockResolvedValue(101);
    const middleware = new RateLimitMiddleware({ get: jest.fn() } as never);

    try {
      await middleware.use(
        { method: 'POST', path: '/auth/refresh', ip: '127.0.0.1' } as never,
        {} as never,
        jest.fn(),
      );
      throw new Error('Expected rate limit error');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });
});
