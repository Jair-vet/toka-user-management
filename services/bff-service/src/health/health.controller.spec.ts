import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('checks auth-service using the real auth health path', () => {
    const health = { check: jest.fn((checks: Array<() => unknown>) => checks[0]()) };
    const http = { pingCheck: jest.fn() };
    const config = { get: jest.fn().mockReturnValue('http://auth-service:3001') };

    const controller = new HealthController(health as never, http as never, config as never);
    controller.check();

    expect(http.pingCheck).toHaveBeenCalledWith(
      'auth-service',
      'http://auth-service:3001/auth/health',
    );
  });
});
