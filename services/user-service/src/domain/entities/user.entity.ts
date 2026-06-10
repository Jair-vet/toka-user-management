import { BaseEntity } from '@toka/shared-kernel';
import { UserCreatedEvent } from '../events/user-created.event';
import { UserUpdatedEvent } from '../events/user-updated.event';
import { UserDeletedEvent } from '../events/user-deleted.event';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
}

export class User extends BaseEntity {
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  avatarUrl: string | null;
  keycloakId: string | null;
  metadata: Record<string, unknown>;
  deletedAt: Date | null;

  constructor(props: {
    id?: string;
    email: string;
    firstName: string;
    lastName: string;
    status?: UserStatus;
    avatarUrl?: string;
    keycloakId?: string;
    metadata?: Record<string, unknown>;
  }) {
    super(props.id);
    this.email = props.email.toLowerCase().trim();
    this.firstName = props.firstName.trim();
    this.lastName = props.lastName.trim();
    this.status = props.status ?? UserStatus.PENDING;
    this.avatarUrl = props.avatarUrl ?? null;
    this.keycloakId = props.keycloakId ?? null;
    this.metadata = props.metadata ?? {};
    this.deletedAt = null;

    if (!props.id) {
      this.addDomainEvent(
        new UserCreatedEvent(this.id, this.email, this.firstName, this.lastName),
      );
    }
  }

  update(props: Partial<{ firstName: string; lastName: string; avatarUrl: string; metadata: Record<string, unknown> }>): void {
    if (props.firstName) this.firstName = props.firstName.trim();
    if (props.lastName) this.lastName = props.lastName.trim();
    if (props.avatarUrl !== undefined) this.avatarUrl = props.avatarUrl;
    if (props.metadata) this.metadata = { ...this.metadata, ...props.metadata };
    this.updatedAt = new Date();
    this.addDomainEvent(new UserUpdatedEvent(this.id, this.email));
  }

  softDelete(): void {
    this.deletedAt = new Date();
    this.status = UserStatus.INACTIVE;
    this.addDomainEvent(new UserDeletedEvent(this.id, this.email));
  }

  activate(): void {
    this.status = UserStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  suspend(): void {
    this.status = UserStatus.SUSPENDED;
    this.updatedAt = new Date();
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  isActive(): boolean {
    return this.status === UserStatus.ACTIVE && !this.deletedAt;
  }
}
