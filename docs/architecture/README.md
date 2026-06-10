# Architecture Documentation

## C4 Context Diagram

```mermaid
C4Context
  title System Context — Toka User Management

  Person(admin, "System Administrator", "Manages users, roles, and permissions")
  Person(user, "Regular User", "Views own profile, uses AI assistant")

  System(toka, "Toka User Management", "User management system with microservices and AI agents")
  System_Ext(keycloak, "Keycloak", "Identity Provider — OIDC/OAuth2")
  System_Ext(openai, "OpenAI API", "LLM + Embeddings for AI features")

  Rel(admin, toka, "Uses", "HTTPS")
  Rel(user, toka, "Uses", "HTTPS")
  Rel(toka, keycloak, "Authenticates via", "OIDC")
  Rel(toka, openai, "Generates embeddings and completions", "HTTPS")
```

## C4 Container Diagram

```mermaid
C4Container
  title Container Diagram — Toka User Management

  Person(browser, "Browser", "Web browser")

  Container(traefik, "Traefik Gateway", "Traefik", "API Gateway — JWT validation, routing, rate limiting")
  Container(frontend, "Frontend", "React + Vite", "SPA — User management UI")
  Container(bff, "BFF Service", "NestJS", "Backend for Frontend — OAuth flow, aggregation, session management")
  Container(auth, "Auth Service", "NestJS", "Authentication — Login, register, token management")
  Container(user, "User Service", "NestJS", "User CRUD and profile management")
  Container(role, "Role Service", "NestJS", "RBAC — Roles and permissions management")
  Container(audit, "Audit Service", "NestJS", "Audit trail — Event consumption and querying")
  Container(ai, "AI Agent Service", "FastAPI", "LangGraph orchestrator, RAG pipeline, embeddings")

  ContainerDb(postgres, "PostgreSQL", "PostgreSQL 16", "Users, roles, permissions, sessions")
  ContainerDb(mongo, "MongoDB", "MongoDB 7", "Audit events, AI conversations, metrics")
  ContainerDb(redis, "Redis", "Redis 7", "JWT blacklist, sessions, cache, rate limiting")
  ContainerDb(qdrant, "Qdrant", "Qdrant v1.9", "Vector embeddings for RAG")
  ContainerQueue(rabbit, "RabbitMQ", "RabbitMQ 3.13", "Async domain events between services")
  System_Ext(keycloak, "Keycloak", "Identity Provider")
  System_Ext(openai, "OpenAI API", "LLM + Embeddings")

  Rel(browser, traefik, "HTTPS :80")
  Rel(traefik, frontend, "HTTP")
  Rel(traefik, bff, "HTTP /bff/*")
  Rel(bff, auth, "HTTP")
  Rel(bff, user, "HTTP")
  Rel(bff, role, "HTTP")
  Rel(bff, audit, "HTTP")
  Rel(bff, ai, "HTTP")
  Rel(auth, keycloak, "OIDC Admin API")
  Rel(auth, postgres, "TypeORM")
  Rel(auth, redis, "ioredis")
  Rel(user, postgres, "TypeORM")
  Rel(role, postgres, "TypeORM")
  Rel(audit, mongo, "Mongoose")
  Rel(ai, qdrant, "HTTP")
  Rel(ai, mongo, "pymongo")
  Rel(ai, openai, "HTTPS")
  Rel(auth, rabbit, "Publish auth.events")
  Rel(user, rabbit, "Publish user.events")
  Rel(role, rabbit, "Publish role.events")
  Rel(audit, rabbit, "Subscribe all events")
  Rel(ai, rabbit, "Subscribe user.created")
```

## DDD Bounded Contexts

| Context | Services | DB | Events Published |
|---------|---------|-----|-----------------|
| Identity | Auth, User | PostgreSQL | user.*, auth.* |
| Authorization | Role | PostgreSQL | role.* |
| Observability | Audit | MongoDB | (consumer only) |
| Intelligence | AI Agent | Qdrant, MongoDB | (consumer only) |

## Clean Architecture Layers

```
┌─────────────────────────────────────────────────┐
│  Presentation Layer                              │
│  Controllers, Guards, Interceptors, Pipes        │
├─────────────────────────────────────────────────┤
│  Application Layer                               │
│  Use Cases, DTOs, Port Interfaces                │
├─────────────────────────────────────────────────┤
│  Domain Layer                                    │
│  Entities, Value Objects, Domain Events          │
│  Repository Interfaces (ports)                   │
├─────────────────────────────────────────────────┤
│  Infrastructure Layer                            │
│  TypeORM repos, Redis, RabbitMQ, Keycloak       │
│  (implementations of domain ports)               │
└─────────────────────────────────────────────────┘
```

Dependency rule: outer layers depend on inner layers. Domain layer has ZERO external dependencies.

## Communication Patterns

### Synchronous (REST)
- BFF → all backend services via HTTP
- AI Agent → User/Role/Audit services (tool calls during agent execution)
- All requests carry `X-Correlation-Id` and `Authorization: Bearer <jwt>`

### Asynchronous (RabbitMQ)
- Domain events published after successful state mutations
- Audit Service consumes ALL events (audit trail)
- Services subscribe only to events they need (decoupled)
- Dead Letter Queue for failed messages
