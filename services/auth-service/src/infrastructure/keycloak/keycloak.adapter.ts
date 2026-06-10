import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenResponseDto } from '../../application/dtos/login.dto';

interface KeycloakTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

@Injectable()
export class KeycloakAdapter {
  private readonly logger = new Logger(KeycloakAdapter.name);
  private readonly baseUrl: string;
  private readonly realm: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly adminUser: string;
  private readonly adminPassword: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.getOrThrow('KEYCLOAK_URL');
    this.realm = config.getOrThrow('KEYCLOAK_REALM');
    this.clientId = config.getOrThrow('KEYCLOAK_CLIENT_ID');
    this.clientSecret = config.getOrThrow('KEYCLOAK_CLIENT_SECRET');
    this.adminUser = config.get('KC_ADMIN_USER') ?? 'admin';
    this.adminPassword = config.get('KC_ADMIN_PASS') ?? 'admin_secret_pass';
  }

  async login(email: string, password: string): Promise<TokenResponseDto> {
    const url = `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`;

    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      username: email,
      password,
      scope: 'openid email profile',
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      this.logger.warn(`Login failed for ${email}: ${response.status}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const data = (await response.json()) as KeycloakTokenResponse;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenResponseDto> {
    const url = `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const data = (await response.json()) as KeycloakTokenResponse;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
    };
  }

  async revokeToken(refreshToken: string): Promise<void> {
    const url = `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/logout`;

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  async createUser(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<string> {
    const adminToken = await this.getAdminToken();
    const url = `${this.baseUrl}/admin/realms/${this.realm}/users`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        email: userData.email,
        username: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        enabled: true,
        emailVerified: true,
        credentials: [{ type: 'password', value: userData.password, temporary: false }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create user in Keycloak: ${error}`);
    }

    const location = response.headers.get('Location') ?? '';
    return location.split('/').pop() ?? '';
  }

  private async getAdminToken(): Promise<string> {
    const url = `${this.baseUrl}/realms/master/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: this.adminUser,
      password: this.adminPassword,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to obtain Keycloak admin token: ${error}`);
    }

    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  }

  getJwksUri(): string {
    return `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/certs`;
  }
}
