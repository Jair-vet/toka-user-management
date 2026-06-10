import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventSubscriber } from '@toka/shared-kernel';
import { AuditEventSchemaClass } from '../persistence/mongoose/audit-event.schema';

interface DomainEventPayload {
  eventId?: string;
  eventType?: string;
  aggregateId?: string;
  aggregateType?: string;
  occurredAt?: string;
  correlationId?: string;
  source?: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class AuditEventSubscriberService implements OnModuleInit {
  private readonly logger = new Logger(AuditEventSubscriberService.name);

  constructor(
    @InjectModel(AuditEventSchemaClass.name)
    private readonly auditModel: Model<AuditEventSchemaClass>,
    private readonly eventSubscriber: EventSubscriber,
  ) {}

  async onModuleInit(): Promise<void> {
    const queues = ['audit.user.queue', 'audit.auth.queue', 'audit.role.queue'];
    for (const queue of queues) {
      await this.eventSubscriber.consume(queue, async (message, ack, nack) => {
        try {
          await this.processEvent(message as DomainEventPayload);
          ack();
        } catch (error) {
          this.logger.error(`Failed to process audit event from ${queue}`, error);
          nack(false);
        }
      });
    }
    this.logger.log('Audit event subscriber initialized');
  }

  private async processEvent(event: DomainEventPayload): Promise<void> {
    if (!event.eventId) {
      this.logger.warn('Received event without eventId, skipping');
      return;
    }

    // Idempotency check
    const existing = await this.auditModel.findOne({ eventId: event.eventId });
    if (existing) return;

    const payload = event.payload ?? {};
    const actor = (payload['userId'] as string) ?? (payload['actor'] as string) ?? 'system';
    const resourceType = event.aggregateType ?? 'Unknown';
    const resourceId = (payload['userId'] as string) ?? (payload['roleId'] as string) ?? event.aggregateId ?? '';

    await this.auditModel.create({
      eventId: event.eventId,
      action: event.eventType ?? 'UNKNOWN',
      actor,
      actorEmail: (payload['email'] as string) ?? (payload['actorEmail'] as string),
      resource: resourceType,
      resourceId,
      changes: {
        before: (payload['before'] as Record<string, unknown>) ?? null,
        after: (payload['after'] as Record<string, unknown>) ?? payload,
      },
      metadata: {
        correlationId: event.correlationId,
        ipAddress: (payload['ipAddress'] as string),
        userAgent: (payload['userAgent'] as string),
      },
      timestamp: event.occurredAt ? new Date(event.occurredAt) : new Date(),
    });

    this.logger.debug({ message: 'Audit event stored', action: event.eventType, actor });
  }
}
