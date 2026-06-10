import { Test, TestingModule } from '@nestjs/testing';
import { AuthApplicationService } from './auth.application-service';
import { KeycloakAdapter } from '../../infrastructure/keycloak/keycloak.adapter';
import { CacheService } from '@toka/shared-kernel';
import { EventPublisher } from '@toka/shared-kernel';
import { UnauthorizedException } from '@nestjs/common';

const mockKeycloak = {
  login: jest.fn(),
  refreshToken: jest.fn(),
  revokeToken: jest.fn(),
  createUser: jest.fn(),
};

const mockCache = {
  blacklistToken: jest.fn(),
  isTokenBlacklisted: jest.fn(),
  set: jest.fn(),
  get: jest.fn(),
};

const mockPublisher = {
  publish: jest.fn(),
};

describe('AuthApplicationService', () => {
  let service: AuthApplicationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthApplicationService,
        { provide: KeycloakAdapter, useValue: mockKeycloak },
        { provide: CacheService, useValue: mockCache },
        { provide: EventPublisher, useValue: mockPublisher },
      ],
    }).compile();

    service = module.get<AuthApplicationService>(AuthApplicationService);
    jest.clearAllMocks();
    mockPublisher.publish.mockResolvedValue(undefined);
  });

  describe('login', () => {
    it('returns token response on valid credentials', async () => {
      mockKeycloak.login.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
      });

      const result = await service.login({
        email: 'admin@toka.com',
        password: 'password',
      }, '127.0.0.1', 'jest');

      expect(result.accessToken).toBe('access-token');
      expect(mockPublisher.publish).toHaveBeenCalled();
    });

    it('throws UnauthorizedException on invalid credentials', async () => {
      mockKeycloak.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      await expect(
        service.login({ email: 'bad@test.com', password: 'wrong' }, '127.0.0.1', 'jest'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('blacklists access token on logout', async () => {
      mockKeycloak.revokeToken.mockResolvedValue(undefined);
      mockCache.blacklistToken.mockResolvedValue(undefined);

      await service.logout('refresh-token', 'jti-123', 'corr-1');

      expect(mockCache.blacklistToken).toHaveBeenCalledWith('jti-123', 900);
    });
  });

  describe('refresh', () => {
    it('returns new tokens on valid refresh token', async () => {
      mockKeycloak.refreshToken.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresIn: 3600,
        tokenType: 'Bearer',
      });

      const result = await service.refresh('old-refresh-token');
      expect(result.accessToken).toBe('new-access');
    });

    it('throws UnauthorizedException on invalid refresh token', async () => {
      mockKeycloak.refreshToken.mockRejectedValue(new UnauthorizedException('Invalid refresh token'));

      await expect(service.refresh('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
