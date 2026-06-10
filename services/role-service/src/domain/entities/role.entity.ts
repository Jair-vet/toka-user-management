import { BaseEntity } from '@toka/shared-kernel';
import { RoleCreatedEvent } from '../events/role-created.event';

export class Role extends BaseEntity {
  name: string;
  description: string;
  isSystem: boolean;

  constructor(props: {
    id?: string;
    name: string;
    description?: string;
    isSystem?: boolean;
  }) {
    super(props.id);
    this.name = props.name.toUpperCase();
    this.description = props.description ?? '';
    this.isSystem = props.isSystem ?? false;

    if (!props.id) {
      this.addDomainEvent(new RoleCreatedEvent(this.id, this.name));
    }
  }

  canBeDeleted(): boolean {
    return !this.isSystem;
  }
}
