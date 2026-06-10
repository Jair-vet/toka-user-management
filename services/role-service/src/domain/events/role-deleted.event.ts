import { BaseDomainEvent } from '@toka/shared-kernel';

export class RoleDeletedEvent extends BaseDomainEvent {
  constructor(roleId: string, roleName: string, deletedBy: string, correlationId?: string) {
    super('role.deleted', roleId, 'Role', 'role-service', { roleId, roleName, deletedBy }, correlationId);
  }
}
