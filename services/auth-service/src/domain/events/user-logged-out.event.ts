import { BaseDomainEvent } from '@toka/shared-kernel';

export class UserLoggedOutEvent extends BaseDomainEvent {
  constructor(userId: string, sessionId: string, correlationId?: string) {
    super(
      'auth.logout',
      sessionId,
      'Session',
      'auth-service',
      { userId, sessionId, timestamp: new Date().toISOString() },
      correlationId,
    );
  }
}
