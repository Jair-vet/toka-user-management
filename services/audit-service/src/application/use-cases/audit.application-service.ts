import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { PaginatedResult } from '@toka/shared-kernel';
import { AuditEventSchemaClass } from '../../infrastructure/persistence/mongoose/audit-event.schema';

export interface AuditQueryOptions {
  page: number;
  limit: number;
  actor?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  from?: string;
  to?: string;
}

export interface AuditEventDto {
  id: string;
  eventId: string;
  action: string;
  actor: string;
  actorEmail?: string;
  resource: string;
  resourceId?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

@Injectable()
export class AuditApplicationService {
  private readonly logger = new Logger(AuditApplicationService.name);

  constructor(
    @InjectModel(AuditEventSchemaClass.name)
    private readonly auditModel: Model<AuditEventSchemaClass>,
  ) {}

  async queryEvents(options: AuditQueryOptions): Promise<PaginatedResult<AuditEventDto>> {
    const { page, limit, actor, action, resource, resourceId, from, to } = options;

    const filter: FilterQuery<AuditEventSchemaClass> = {};
    if (actor) filter['actor'] = actor;
    if (action) filter['action'] = { $regex: action, $options: 'i' };
    if (resource) filter['resource'] = resource;
    if (resourceId) filter['resourceId'] = resourceId;
    if (from || to) {
      filter['timestamp'] = {};
      if (from) filter['timestamp']['$gte'] = new Date(from);
      if (to) filter['timestamp']['$lte'] = new Date(to);
    }

    const total = await this.auditModel.countDocuments(filter);
    const docs = await this.auditModel
      .find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      data: docs.map((d) => ({
        id: String(d['_id']),
        eventId: d['eventId'] as string,
        action: d['action'] as string,
        actor: d['actor'] as string,
        actorEmail: d['actorEmail'] as string | undefined,
        resource: d['resource'] as string,
        resourceId: d['resourceId'] as string | undefined,
        changes: d['changes'] as Record<string, unknown> | undefined,
        metadata: d['metadata'] as Record<string, unknown> | undefined,
        timestamp: d['timestamp'] as Date,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
