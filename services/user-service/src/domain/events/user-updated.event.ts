import { BaseDomainEvent } from '@toka/shared-kernel';

export class UserUpdatedEvent extends BaseDomainEvent {
  constructor(userId: string, email: string, correlationId?: string) {
    super('user.updated', userId, 'User', 'user-service', { userId, email }, correlationId);
  }
}
