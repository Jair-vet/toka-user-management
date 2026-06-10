import { BaseDomainEvent } from '@toka/shared-kernel';

export class RoleRevokedEvent extends BaseDomainEvent {
  constructor(userId: string, roleId: string, revokedBy: string, correlationId?: string) {
    super('role.revoked', userId, 'UserRole', 'role-service', { userId, roleId, revokedBy }, correlationId);
  }
}
