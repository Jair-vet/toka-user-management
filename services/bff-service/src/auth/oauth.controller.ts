import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  Body,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import axios from 'axios';
import { randomBytes, createHash } from 'crypto';

interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  id_token?: string;
}

@Controller('auth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(private readonly config: ConfigService) {}

  @Get('login')
  async login(@Req() req: Request, @Res() res: Response) {
    const keycloak = this.config.get('keycloak');

    // PKCE
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    const state = randomBytes(16).toString('hex');

    const session = (req as Request & { session: Record<string, unknown> }).session;
    session['pkce_verifier'] = codeVerifier;
    session['oauth_state'] = state;

    const authUrl = new URL(
      `${keycloak.publicUrl}/realms/${keycloak.realm}/protocol/openid-connect/auth`,
    );
    authUrl.searchParams.set('client_id', keycloak.clientId);
    authUrl.searchParams.set('redirect_uri', keycloak.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);

    return res.redirect(authUrl.toString());
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const session = (req as Request & { session: Record<string, unknown> }).session;
    const keycloak = this.config.get('keycloak');

    if (state !== session['oauth_state']) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    const codeVerifier = session['pkce_verifier'] as string;
    delete session['pkce_verifier'];
    delete session['oauth_state'];

    const tokenUrl = `${keycloak.url}/realms/${keycloak.realm}/protocol/openid-connect/token`;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: keycloak.clientId,
      redirect_uri: keycloak.redirectUri,
      code,
      code_verifier: codeVerifier,
    });

    if (keycloak.clientSecret) {
      params.set('client_secret', keycloak.clientSecret);
    }

    const { data } = await axios.post<TokenSet>(tokenUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    session['accessToken'] = data.access_token;
    session['refreshToken'] = data.refresh_token;
    session['expiresAt'] = Date.now() + data.expires_in * 1000;

    const frontendUrl = this.config.get<string[]>('cors.origins')![0];
    return res.redirect(`${frontendUrl}/dashboard`);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res() res: Response) {
    const session = (req as Request & { session: Record<string, unknown> }).session;
    const keycloak = this.config.get('keycloak');
    const refreshToken = session['refreshToken'] as string;

    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token' });
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: keycloak.clientId,
      refresh_token: refreshToken,
    });
    if (keycloak.clientSecret) params.set('client_secret', keycloak.clientSecret);

    const { data } = await axios.post<TokenSet>(
      `${keycloak.url}/realms/${keycloak.realm}/protocol/openid-connect/token`,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    session['accessToken'] = data.access_token;
    session['refreshToken'] = data.refresh_token;
    session['expiresAt'] = Date.now() + data.expires_in * 1000;

    return res.json({ access_token: data.access_token, expires_in: data.expires_in });
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res() res: Response) {
    const session = (req as Request & { session: Record<string, unknown> }).session;
    const keycloak = this.config.get('keycloak');
    const refreshToken = session['refreshToken'] as string;

    if (refreshToken) {
      const params = new URLSearchParams({
        client_id: keycloak.clientId,
        refresh_token: refreshToken,
      });
      if (keycloak.clientSecret) params.set('client_secret', keycloak.clientSecret);
      try {
        await axios.post(
          `${keycloak.url}/realms/${keycloak.realm}/protocol/openid-connect/logout`,
          params.toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        );
      } catch (e) {
        this.logger.warn('Could not revoke token on logout');
      }
    }

    (req as Request & { session: { destroy: (callback: () => void) => void } }).session.destroy(() => {
      res.clearCookie('connect.sid');
      return res.status(204).send();
    });
  }

  @Get('me')
  async me(@Req() req: Request, @Res() res: Response) {
    const session = (req as Request & { session: Record<string, unknown> }).session;
    if (!session['accessToken']) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const keycloak = this.config.get('keycloak');
    const { data } = await axios.get(
      `${keycloak.url}/realms/${keycloak.realm}/protocol/openid-connect/userinfo`,
      { headers: { authorization: `Bearer ${session['accessToken']}` } },
    );
    return res.json(data);
  }

  @Get('csrf-token')
  getCsrfToken(@Req() req: Request & { csrfToken?: () => string }, @Res() res: Response) {
    const token = req.csrfToken ? req.csrfToken() : 'csrf-not-configured';
    return res.json({ csrfToken: token });
  }
}
