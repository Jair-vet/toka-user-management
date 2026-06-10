import { BaseDomainEvent } from '@toka/shared-kernel';

export class UserCreatedEvent extends BaseDomainEvent {
  constructor(userId: string, email: string, firstName: string, lastName: string, correlationId?: string) {
    super('user.created', userId, 'User', 'user-service', { userId, email, firstName, lastName }, correlationId);
  }
}
