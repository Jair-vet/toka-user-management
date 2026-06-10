import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class JwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);
    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }
    // BFF trusts the token — Traefik already validated via JWKS forward auth.
    // If behind Traefik, just pass through. In direct mode, require header present.
    return true;
  }

  private extractToken(req: Request): string | null {
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    // Also accept from session cookie for browser flows
    const session = (req as Request & { session?: Record<string, unknown> }).session;
    if (session?.accessToken) {
      req.headers['authorization'] = `Bearer ${session.accessToken}`;
      return session.accessToken as string;
    }
    return null;
  }
}
