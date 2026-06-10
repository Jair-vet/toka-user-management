import { BaseDomainEvent } from '@toka/shared-kernel';

export class RoleCreatedEvent extends BaseDomainEvent {
  constructor(roleId: string, roleName: string, createdBy?: string, correlationId?: string) {
    super('role.created', roleId, 'Role', 'role-service', { roleId, roleName, createdBy }, correlationId);
  }
}
