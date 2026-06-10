import { BaseDomainEvent } from '@toka/shared-kernel';

export class RoleAssignedEvent extends BaseDomainEvent {
  constructor(userId: string, roleId: string, roleName: string, assignedBy: string, correlationId?: string) {
    super('role.assigned', userId, 'UserRole', 'role-service', { userId, roleId, roleName, assignedBy }, correlationId);
  }
}
