import { v4 as uuidv4 } from 'uuid';
import { DomainEvent } from './domain-event';

export abstract class BaseEntity {
  readonly id: string;
  readonly createdAt: Date;
  updatedAt: Date;

  private _domainEvents: DomainEvent[] = [];

  constructor(id?: string) {
    this.id = id ?? uuidv4();
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  getDomainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  equals(other: BaseEntity): boolean {
    return other instanceof BaseEntity && this.id === other.id;
  }
}
