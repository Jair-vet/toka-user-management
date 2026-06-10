import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';
import { CacheService } from '../redis/cache.service';
import { IS_PUBLIC_KEY } from '../../guards/public.decorator';

export interface JwtPayload {
  sub: string;
  email: string;
  iss?: string;
  aud?: string | string[];
  azp?: string;
  jti?: string;
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtGuard implements CanActivate {
  private jwksClient: jwksClient.JwksClient;

  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: CacheService,
    @Inject('KEYCLOAK_JWKS_URI') private readonly jwksUri: string,
    @Inject('KEYCLOAK_CLIENT_ID') private readonly clientId: string,
  ) {
    this.jwksClient = jwksClient.default({
      jwksUri: this.jwksUri,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000, // 10 min
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    try {
      const payload = await this.verifyToken(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: { headers: Record<string, string> }): string | null {
    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) return null;
    return authHeader.substring(7);
  }

  private async verifyToken(token: string): Promise<JwtPayload> {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new Error('Invalid token format');
    }

    const kid = decoded.header.kid;
    const signingKey = await this.jwksClient.getSigningKey(kid);
    const publicKey = signingKey.getPublicKey();

    const payload = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: this.jwksUri.replace('/protocol/openid-connect/certs', ''),
    }) as JwtPayload;

    this.validateClient(payload);

    // Check blacklist
    if (payload.jti) {
      const isBlacklisted = await this.cacheService.isTokenBlacklisted(payload.jti);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }
    }

    return payload;
  }

  private validateClient(payload: JwtPayload): void {
    const allowedClients = new Set(
      this.clientId
        .split(',')
        .map((client) => client.trim())
        .filter(Boolean),
    );

    allowedClients.add('backend-services');
    allowedClients.add('toka-frontend');

    if (payload.azp && allowedClients.has(payload.azp)) {
      return;
    }

    const audiences = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
    if (audiences.some((audience) => allowedClients.has(audience))) {
      return;
    }

    throw new Error('Token client is not allowed');
  }
}
