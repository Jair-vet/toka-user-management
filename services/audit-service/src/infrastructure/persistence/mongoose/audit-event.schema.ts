import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose';

export type AuditEventDocument = HydratedDocument<AuditEventSchemaClass>;

@Schema({ collection: 'audit_events', timestamps: false })
export class AuditEventSchemaClass {
  @Prop({ required: true, unique: true })
  eventId!: string;

  @Prop({ required: true })
  action!: string;

  @Prop({ required: true })
  actor!: string;

  @Prop()
  actorEmail?: string;

  @Prop({ required: true })
  resource!: string;

  @Prop()
  resourceId?: string;

  @Prop({ type: Object })
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> };

  @Prop({
    type: {
      ipAddress: String,
      userAgent: String,
      correlationId: String,
    },
  })
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
  };

  @Prop({ required: true })
  timestamp!: Date;
}

export const AuditEventSchema = SchemaFactory.createForClass(AuditEventSchemaClass);

AuditEventSchema.index({ actor: 1, timestamp: -1 });
AuditEventSchema.index({ resource: 1, resourceId: 1, timestamp: -1 });
AuditEventSchema.index({ action: 1, timestamp: -1 });
AuditEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 }); // TTL 1 year
