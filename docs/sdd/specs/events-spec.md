# Event Specification — RabbitMQ

## Exchange Topology

```
Exchange: user.events (type: topic, durable: true)
  Binding Keys:
    user.created    →  queue: audit.user.queue, queue: ai.user.queue
    user.updated    →  queue: audit.user.queue
    user.deleted    →  queue: audit.user.queue, queue: role.user-deleted.queue

Exchange: auth.events (type: topic, durable: true)
  Binding Keys:
    auth.login.success  →  queue: audit.auth.queue
    auth.login.failed   →  queue: audit.auth.queue
    auth.logout         →  queue: audit.auth.queue

Exchange: role.events (type: topic, durable: true)
  Binding Keys:
    role.assigned   →  queue: audit.role.queue, queue: user.role-cache.queue
    role.revoked    →  queue: audit.role.queue, queue: user.role-cache.queue
    role.created    →  queue: audit.role.queue

Exchange: dlx.events (type: fanout — Dead Letter Exchange)
  →  queue: dlq.events (manual inspection)
```

## Queue Definitions

| Queue | Exchange | Routing Key | Consumer | DLX |
|-------|----------|------------|---------|-----|
| `audit.user.queue` | user.events | `user.*` | Audit Service | dlx.events |
| `audit.auth.queue` | auth.events | `auth.*` | Audit Service | dlx.events |
| `audit.role.queue` | role.events | `role.*` | Audit Service | dlx.events |
| `ai.user.queue` | user.events | `user.created` | AI Agent Service | dlx.events |
| `user.role-cache.queue` | role.events | `role.assigned,role.revoked` | User Service | dlx.events |
| `role.user-deleted.queue` | user.events | `user.deleted` | Role Service | dlx.events |
| `dlq.events` | dlx.events | `#` | Manual / Alerting | - |

## Event Schemas

### Base Domain Event
```json
{
  "eventId": "uuid-v4",
  "eventType": "user.created",
  "aggregateId": "user-uuid",
  "aggregateType": "User",
  "occurredAt": "2025-06-09T12:00:00.000Z",
  "version": 1,
  "correlationId": "request-uuid",
  "source": "user-service",
  "payload": {}
}
```

### user.created
```json
{
  "eventType": "user.created",
  "aggregateType": "User",
  "payload": {
    "userId": "uuid",
    "email": "user@toka.com",
    "firstName": "John",
    "lastName": "Doe",
    "status": "PENDING"
  }
}
```

### role.assigned
```json
{
  "eventType": "role.assigned",
  "aggregateType": "UserRole",
  "payload": {
    "userId": "uuid",
    "roleId": "uuid",
    "roleName": "USER_MANAGER",
    "assignedBy": "admin-uuid"
  }
}
```

### auth.login.success
```json
{
  "eventType": "auth.login.success",
  "aggregateType": "Session",
  "payload": {
    "userId": "uuid",
    "sessionId": "uuid",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "timestamp": "2025-06-09T12:00:00.000Z"
  }
}
```
