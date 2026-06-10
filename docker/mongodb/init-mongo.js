// ===========================
// Toka MongoDB Initialization
// ===========================

// Switch to toka_audit database
db = db.getSiblingDB('toka_audit');

// Create audit_events collection with schema validation
db.createCollection('audit_events', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['eventId', 'action', 'actor', 'resource', 'timestamp'],
      properties: {
        eventId: { bsonType: 'string', description: 'UUID v4 for idempotency' },
        action: { bsonType: 'string', description: 'Audit action type' },
        actor: { bsonType: 'string', description: 'User ID who performed the action' },
        actorEmail: { bsonType: 'string' },
        resource: { bsonType: 'string', description: 'Resource type (User, Role, etc.)' },
        resourceId: { bsonType: 'string' },
        changes: {
          bsonType: 'object',
          properties: {
            before: { bsonType: ['object', 'null'] },
            after: { bsonType: ['object', 'null'] }
          }
        },
        metadata: {
          bsonType: 'object',
          properties: {
            ipAddress: { bsonType: 'string' },
            userAgent: { bsonType: 'string' },
            correlationId: { bsonType: 'string' }
          }
        },
        timestamp: { bsonType: 'date' }
      }
    }
  }
});

// Indexes for audit_events
db.audit_events.createIndex({ timestamp: -1 });
db.audit_events.createIndex({ actor: 1, timestamp: -1 });
db.audit_events.createIndex({ resource: 1, resourceId: 1, timestamp: -1 });
db.audit_events.createIndex({ action: 1, timestamp: -1 });
db.audit_events.createIndex({ eventId: 1 }, { unique: true });

// TTL index: auto-delete events older than 1 year
db.audit_events.createIndex({ timestamp: 1 }, { expireAfterSeconds: 31536000 });

print('toka_audit: audit_events collection created with indexes');

// Switch to toka_ai database
db = db.getSiblingDB('toka_ai');

// Create conversations collection
db.createCollection('conversations');
db.conversations.createIndex({ userId: 1, updatedAt: -1 });
db.conversations.createIndex({ sessionId: 1 }, { unique: true });

// Create ai_metrics collection
db.createCollection('ai_metrics');
db.ai_metrics.createIndex({ timestamp: -1 });
db.ai_metrics.createIndex({ userId: 1, timestamp: -1 });
// TTL: delete metrics older than 90 days
db.ai_metrics.createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

print('toka_ai: conversations and ai_metrics collections created');
