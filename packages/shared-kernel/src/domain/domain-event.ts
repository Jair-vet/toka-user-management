import { v4 as uuidv4 } from 'uuid';

export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly occurredAt: Date;
  readonly version: number;
  readonly correlationId: string;
  readonly source: string;
  readonly payload: Record<string, unknown>;
}

export abstract class BaseDomainEvent implements DomainEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly version: number;

  constructor(
    public readonly eventType: string,
    public readonly aggregateId: string,
    public readonly aggregateType: string,
    public readonly source: string,
    public readonly payload: Record<string, unknown>,
    public readonly correlationId: string = uuidv4(),
  ) {
    this.eventId = uuidv4();
    this.occurredAt = new Date();
    this.version = 1;
  }
}
