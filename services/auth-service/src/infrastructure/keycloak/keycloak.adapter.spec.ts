import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { KeycloakAdapter } from './keycloak.adapter';

const config = {
  getOrThrow: jest.fn((key: string) => {
    const values: Record<string, string> = {
      KEYCLOAK_URL: 'http://keycloak:8080',
      KEYCLOAK_REALM: 'toka',
      KEYCLOAK_CLIENT_ID: 'backend-services',
      KEYCLOAK_CLIENT_SECRET: 'backend-client-secret',
    };
    return values[key];
  }),
  get: jest.fn((key: string) => {
    const values: Record<string, string> = {
      KC_ADMIN_USER: 'admin',
      KC_ADMIN_PASS: 'admin_secret_pass',
    };
    return values[key];
  }),
};

describe('KeycloakAdapter', () => {
  let adapter: KeycloakAdapter;
  const fetchMock = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeycloakAdapter,
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    adapter = module.get(KeycloakAdapter);
    global.fetch = fetchMock as never;
    jest.clearAllMocks();
  });

  it('login calls token endpoint and maps token response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'tok',
        refresh_token: 'ref',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    });

    const result = await adapter.login('user@test.com', 'Password1!');

    expect(result.accessToken).toBe('tok');
    expect(result.refreshToken).toBe('ref');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://keycloak:8080/realms/toka/protocol/openid-connect/token',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws UnauthorizedException when login fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(adapter.login('bad@test.com', 'wrong')).rejects.toThrow(UnauthorizedException);
  });

  it('refreshes tokens', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 900,
        token_type: 'Bearer',
      }),
    });

    const result = await adapter.refreshToken('old-refresh');

    expect(result.accessToken).toBe('new-access');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://keycloak:8080/realms/toka/protocol/openid-connect/token',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws UnauthorizedException when refresh fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });

    await expect(adapter.refreshToken('bad-refresh')).rejects.toThrow(UnauthorizedException);
  });

  it('revokes refresh token', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true });

    await adapter.revokeToken('refresh-token');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://keycloak:8080/realms/toka/protocol/openid-connect/logout',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('creates user with admin token', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'admin-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'http://keycloak/admin/realms/toka/users/user-1' },
      });

    const userId = await adapter.createUser({
      email: 'new@toka.com',
      password: 'Password1!',
      firstName: 'New',
      lastName: 'User',
    });

    expect(userId).toBe('user-1');
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://keycloak:8080/realms/master/protocol/openid-connect/token',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://keycloak:8080/admin/realms/toka/users',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      }),
    );
  });

  it('returns realm JWKS URI', () => {
    expect(adapter.getJwksUri()).toBe(
      'http://keycloak:8080/realms/toka/protocol/openid-connect/certs',
    );
  });
});
