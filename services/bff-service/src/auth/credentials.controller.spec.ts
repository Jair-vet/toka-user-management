import axios from 'axios';
import { CredentialsController } from './credentials.controller';

jest.mock('axios');

describe('CredentialsController', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards credentials to auth-service and stores tokens in the session', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 300,
        tokenType: 'Bearer',
      },
    });

    const config = { get: jest.fn().mockReturnValue('http://auth-service:3001') };
    const req = { session: {} };
    const res = { json: jest.fn((payload) => payload) };
    const controller = new CredentialsController(config as never);

    const response = await controller.login(
      { email: 'admin@toka.com', password: 'Admin123!' },
      req as never,
      res as never,
    );

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://auth-service:3001/auth/login',
      { email: 'admin@toka.com', password: 'Admin123!' },
      { headers: { 'Content-Type': 'application/json' } },
    );
    expect(req.session).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(req.session).toHaveProperty('expiresAt');
    expect(response).toEqual({
      accessToken: 'access-token',
      expiresIn: 300,
      tokenType: 'Bearer',
    });
  });
});
