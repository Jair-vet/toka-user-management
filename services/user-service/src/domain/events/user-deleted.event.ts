import { BaseDomainEvent } from '@toka/shared-kernel';

export class UserDeletedEvent extends BaseDomainEvent {
  constructor(userId: string, email: string, correlationId?: string) {
    super('user.deleted', userId, 'User', 'user-service', { userId, email }, correlationId);
  }
}
