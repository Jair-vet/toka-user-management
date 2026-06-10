import { BaseDomainEvent } from '@toka/shared-kernel';

export class UserLoggedInEvent extends BaseDomainEvent {
  constructor(
    userId: string,
    sessionId: string,
    ipAddress: string,
    correlationId?: string,
  ) {
    super(
      'auth.login.success',
      sessionId,
      'Session',
      'auth-service',
      { userId, sessionId, ipAddress, timestamp: new Date().toISOString() },
      correlationId,
    );
  }
}
