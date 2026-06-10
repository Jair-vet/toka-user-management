# Domain Model Specification

## Bounded Contexts

```
┌─────────────────────────────┐  ┌─────────────────────────────┐
│   Identity Context          │  │   Authorization Context      │
│                             │  │                              │
│  ┌─────────┐  ┌──────────┐  │  │  ┌──────┐  ┌────────────┐  │
│  │  User   │  │  Session │  │  │  │ Role │  │ Permission │  │
│  └─────────┘  └──────────┘  │  │  └──────┘  └────────────┘  │
│  ┌──────────────────────┐   │  │  ┌────────────────────────┐ │
│  │ RefreshToken         │   │  │  │     UserRole (join)     │ │
│  └──────────────────────┘   │  │  └────────────────────────┘ │
└─────────────────────────────┘  └─────────────────────────────┘

┌─────────────────────────────┐  ┌─────────────────────────────┐
│   Observability Context     │  │   Intelligence Context       │
│                             │  │                              │
│  ┌────────────────────┐     │  │  ┌────────────────────────┐ │
│  │   AuditEvent        │     │  │  │     Conversation       │ │
│  └────────────────────┘     │  │  └────────────────────────┘ │
│                             │  │  ┌────────────────────────┐ │
│                             │  │  │   DocumentChunk        │ │
│                             │  │  └────────────────────────┘ │
└─────────────────────────────┘  └─────────────────────────────┘
```

## Entity Definitions

### User (Aggregate Root — Identity Context)
```
User {
  id: UUID (PK)
  email: Email (VO, unique, validated)
  firstName: string (2-100 chars)
  lastName: string (2-100 chars)
  status: UserStatus (ACTIVE | INACTIVE | SUSPENDED | PENDING)
  avatarUrl: string? (URL)
  keycloakId: UUID? (reference to Keycloak user)
  metadata: JSON {}
  createdAt: DateTime
  updatedAt: DateTime
  deletedAt: DateTime? (soft delete)
}

Domain Events:
  UserCreated, UserUpdated, UserDeleted, UserSuspended, UserActivated
```

### Role (Entity — Authorization Context)
```
Role {
  id: UUID (PK)
  name: RoleName (VO, unique, 3-50 chars, uppercase)
  description: string?
  isSystem: boolean (default: false — system roles cannot be deleted)
  createdAt: DateTime
}

Domain Events:
  RoleCreated, RoleUpdated, RoleDeleted
```

### Permission (Entity — Authorization Context)
```
Permission {
  id: UUID (PK)
  resource: string (e.g., "users", "roles", "audit")
  action: string (e.g., "read", "write", "delete", "manage")
  scope: PermissionScope (GLOBAL | OWN | TEAM)
  description: string?
  UNIQUE(resource, action, scope)
}
```

### UserRole (Join Entity — Authorization Context)
```
UserRole {
  userId: UUID (FK → User)
  roleId: UUID (FK → Role)
  assignedAt: DateTime
  assignedBy: UUID (userId who assigned)
  PRIMARY KEY (userId, roleId)
}

Domain Events:
  RoleAssigned, RoleRevoked
```

### Session (Entity — Identity Context)
```
Session {
  id: UUID (PK)
  userId: UUID
  deviceInfo: JSON { browser, os, ip }
  ipAddress: string
  createdAt: DateTime
  expiresAt: DateTime
  isRevoked: boolean
}

Domain Events:
  SessionCreated, SessionRevoked
```

### AuditEvent (Document — Observability Context)
```
AuditEvent {
  _id: ObjectId (MongoDB)
  eventId: UUID (idempotency)
  action: AuditAction (enum)
  actor: UUID (userId)
  actorEmail: string
  resource: string (e.g., "User", "Role")
  resourceId: string
  changes: { before: JSON, after: JSON }
  metadata: {
    ipAddress: string
    userAgent: string
    correlationId: UUID
  }
  timestamp: DateTime
  TTL: 365 days
}

AuditAction enum:
  USER_CREATED, USER_UPDATED, USER_DELETED, USER_SUSPENDED,
  ROLE_CREATED, ROLE_ASSIGNED, ROLE_REVOKED,
  AUTH_LOGIN, AUTH_LOGOUT, AUTH_FAILED,
  PERMISSION_GRANTED, PERMISSION_REVOKED
```

### Conversation (Document — Intelligence Context)
```
Conversation {
  _id: ObjectId
  sessionId: UUID
  userId: UUID
  messages: [{
    role: "user" | "assistant" | "system"
    content: string
    timestamp: DateTime
    tokens: { input: number, output: number }
    latencyMs: number
  }]
  createdAt: DateTime
  updatedAt: DateTime
}
```

## Value Objects

```
Email: string — validated regex, lowercase, trimmed
UserName: string — 2-100 chars, trimmed
RoleName: string — 3-50 chars, SCREAMING_SNAKE_CASE
PermissionScope: enum GLOBAL | OWN | TEAM
UserStatus: enum ACTIVE | INACTIVE | SUSPENDED | PENDING
TokenPair: { accessToken: string, refreshToken: string, expiresIn: number }
```

## Entity Relationships (PostgreSQL)

```
users.users (1) ←── (M) roles.user_roles (M) ──→ (1) roles.roles
                                                          │
                                                          ▼ (M)
                                                    roles.role_permissions
                                                          │
                                                          ▼ (M)
                                                    roles.permissions
```
