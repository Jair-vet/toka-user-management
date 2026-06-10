import { Injectable, Logger } from '@nestjs/common';
import { CacheService, decodeJwtPayload, EventPublisher } from '@toka/shared-kernel';
import { KeycloakAdapter } from '../../infrastructure/keycloak/keycloak.adapter';
import { LoginDto, RegisterDto, TokenResponseDto } from '../dtos/login.dto';
import { UserLoggedInEvent } from '../../domain/events/user-logged-in.event';
import { UserLoggedOutEvent } from '../../domain/events/user-logged-out.event';

@Injectable()
export class AuthApplicationService {
  private readonly logger = new Logger(AuthApplicationService.name);

  constructor(
    private readonly keycloak: KeycloakAdapter,
    private readonly cache: CacheService,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async login(dto: LoginDto, ipAddress: string, userAgent: string): Promise<TokenResponseDto> {
    const tokens = await this.keycloak.login(dto.email, dto.password);

    // Extract userId from token
    const decoded = decodeJwtPayload<{ sub: string }>(tokens.accessToken);
    const userId = decoded?.sub ?? 'unknown';

    // Publish auth event (async, non-blocking)
    this.eventPublisher
      .publish('auth.events', 'auth.login.success', new UserLoggedInEvent(userId, userId, ipAddress))
      .catch((err: unknown) => this.logger.error('Failed to publish login event', err));

    this.logger.log({ message: 'User logged in', userId, action: 'auth.login' });
    return tokens;
  }

  async register(dto: RegisterDto): Promise<void> {
    await this.keycloak.createUser({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
    this.logger.log({ message: 'User registered', email: dto.email, action: 'auth.register' });
  }

  async refresh(refreshToken: string): Promise<TokenResponseDto> {
    return this.keycloak.refreshToken(refreshToken);
  }

  async logout(refreshToken: string, jti?: string, correlationId?: string): Promise<void> {
    await this.keycloak.revokeToken(refreshToken);

    if (jti) {
      // Blacklist the access token (TTL = remaining time ~15min)
      await this.cache.blacklistToken(jti, 900);
    }

    // Publish logout event
    this.eventPublisher
      .publish('auth.events', 'auth.logout', new UserLoggedOutEvent('unknown', 'unknown', correlationId))
      .catch((err: unknown) => this.logger.error('Failed to publish logout event', err));
  }
}
