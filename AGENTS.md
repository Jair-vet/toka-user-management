# AGENTS.md — SDD Constitution
# Toka User Management System

## 1. Metodología: SPECS-Driven Design (SDD)

Este proyecto sigue la metodología SDD en 4 fases:

```
SPECIFY → PLAN → TASKS → IMPLEMENT
```

- **Specify**: Documentar intención, criterios de aceptación (EARS), modelos de dominio
- **Plan**: Traducir specs a arquitectura, modelos de datos, contratos de API
- **Tasks**: Descomponer en ítems atómicos con dependencias
- **Implement**: Agentes ejecutan tareas acotadas por specs

## 2. Estándares de Código

### TypeScript / NestJS
- Strict TypeScript (`strict: true`)
- Clean Architecture: `domain/` → `application/` → `infrastructure/` → `presentation/`
- DDD: Entities, Value Objects, Aggregates, Domain Events, Repository Interfaces
- SOLID principles enforced
- No `any` — usar tipos explícitos o genéricos
- Naming: `PascalCase` (clases), `camelCase` (variables/métodos), `kebab-case` (archivos)
- Archivos: `user.entity.ts`, `create-user.use-case.ts`, `user.controller.ts`

### Python / FastAPI
- Type hints en todas las funciones
- Pydantic models para I/O
- Clean Architecture adaptada: `domain/`, `application/`, `infrastructure/`, `api/`
- PEP 8, black formatter, isort
- Naming: `snake_case` todo

### General
- Sin secrets hardcodeados — siempre variables de entorno
- Sin `console.log` en producción — usar logger estructurado (JSON)
- Correlation IDs propagados en todos los requests (`X-Correlation-Id` header)
- Health checks en `/health` de todos los servicios

## 3. Convenciones de Commits

Seguir Conventional Commits:

```
type(scope): description

feat(user-service): add soft delete endpoint
fix(auth-service): token refresh race condition
refactor(shared-kernel): extract base repository
test(role-service): add permission assignment unit tests
docs(architecture): update C4 container diagram
chore(docker): add health check to postgres service
```

**Types**: feat, fix, refactor, test, docs, chore, perf, ci

## 4. Estructura de Microservicios NestJS

Cada microservicio sigue esta estructura:

```
services/{service-name}/
├── Dockerfile
├── package.json
├── tsconfig.json
├── nest-cli.json
├── .env.example
└── src/
    ├── main.ts
    ├── app.module.ts
    ├── domain/
    │   ├── entities/         # Aggregate roots, entities
    │   ├── value-objects/    # Value Objects inmutables
    │   ├── events/           # Domain Events
    │   └── repositories/     # Repository interfaces (ports)
    ├── application/
    │   ├── use-cases/        # Un archivo por caso de uso
    │   ├── dtos/             # DTOs de entrada/salida
    │   └── ports/            # Interfaces de servicios externos
    ├── infrastructure/
    │   ├── persistence/      # TypeORM / Mongoose implementations
    │   ├── messaging/        # RabbitMQ publishers/subscribers
    │   └── external/         # Adapters para servicios externos
    └── presentation/
        ├── controllers/      # HTTP controllers
        ├── guards/           # Auth guards
        ├── interceptors/     # Cross-cutting concerns
        └── pipes/            # Validation pipes
```

## 5. SDD Skills, Agents y Routines

### Skills (Capacidades Reutilizables)
Los skills son módulos NestJS o utilidades Python reutilizables entre servicios:

| ID | Skill | Módulo/Ubicación |
|----|-------|-----------------|
| SK-AUTH-01 | jwt-validation | `shared-kernel/src/infrastructure/jwt/` |
| SK-AUTH-02 | oauth-flow | `services/bff-service/src/auth/` |
| SK-USER-01 | user-crud | `services/user-service/src/application/use-cases/` |
| SK-ROLE-01 | rbac-enforcement | `shared-kernel/src/guards/` |
| SK-AUDIT-01 | audit-logging | `services/audit-service/src/infrastructure/messaging/` |
| SK-AI-01 | rag-query | `services/ai-agent-service/src/agents/rag_agent.py` |
| SK-AI-02 | embedding-pipeline | `services/ai-agent-service/src/rag/pipeline.py` |
| SK-AI-03 | tool-execution | `services/ai-agent-service/src/agents/tools/` |
| SK-INFRA-01 | event-publishing | `shared-kernel/src/infrastructure/rabbitmq/` |
| SK-INFRA-02 | cache-management | `shared-kernel/src/infrastructure/redis/` |

### Agents (Roles IA Especializados — LangGraph Nodes)
Los agents son nodos en el StateGraph de LangGraph:

| ID | Agent | Archivo | Responsabilidad |
|----|-------|---------|----------------|
| AG-ORC | Orchestrator | `orchestrator.py` | Clasificar intent, enrutar a sub-agents |
| AG-RAG | RAG Agent | `rag_agent.py` | Responder preguntas desde vector store |
| AG-RPT | Report Agent | `report_agent.py` | Generar reportes desde datos vivos |
| AG-ADM | Admin Assistant | `admin_assistant.py` | Interfaz NL para administración |

### Routines (Workflows Orquestados)
Los routines son flujos que orquestan skills y agents:

| ID | Routine | Trigger | Steps |
|----|---------|---------|-------|
| RT-01 | User Onboarding | `POST /users` | CreateUser → AssignDefaultRole → AuditLog |
| RT-02 | User Deletion | `DELETE /users/:id` | SoftDelete → RevokeRoles → InvalidateSessions → AuditLog |
| RT-03 | Role Assignment | `POST /roles/:id/assign` | ValidateRole → Assign → InvalidateCache → AuditLog |
| RT-04 | Doc Ingestion | `POST /ai/documents/ingest` | Receive → Chunk → Embed → Upsert → AuditLog |
| RT-05 | AI Query | `POST /ai/chat` | ClassifyIntent → RouteAgent → ExecuteTools → Generate → TrackMetrics |

## 6. Seguridad (OWASP)

- Input validation: `class-validator` (NestJS), Pydantic (Python) en TODOS los endpoints
- Sin raw SQL — TypeORM parameterized queries siempre
- Rate limiting en BFF: 100 req/min/usuario via Redis
- CORS: solo `http://localhost:5173` (dev) / dominio de producción
- Security headers: `@nestjs/helmet` en BFF
- CSRF: double-submit cookie en BFF
- Tokens: HttpOnly + Secure + SameSite=Strict
- Secrets: NUNCA en código o git — siempre `.env`

## 7. Testing

- Unit tests: Jest (NestJS) / pytest (Python)
- Coverage mínimo: **70% por servicio**
- Mocks: TypeORM repositories, RabbitMQ publisher, Redis client
- Integration tests: testcontainers o docker-compose.test.yml
- Frontend: Vitest + React Testing Library

## 8. Logging

Formato JSON estructurado en todos los servicios:

```json
{
  "timestamp": "2025-06-09T12:00:00.000Z",
  "level": "info",
  "service": "user-service",
  "correlationId": "uuid-v4",
  "message": "User created successfully",
  "userId": "uuid",
  "action": "user.created"
}
```

## 9. Event Contracts

Todos los eventos de dominio siguen este schema base:

```typescript
interface DomainEvent {
  eventId: string;        // UUID v4
  eventType: string;      // "user.created", "role.assigned", etc.
  aggregateId: string;    // ID del aggregate raíz
  aggregateType: string;  // "User", "Role", etc.
  occurredAt: string;     // ISO 8601
  version: number;        // Para evolución de eventos
  correlationId: string;  // Tracing
  payload: Record<string, unknown>;
}
```

## 10. API Response Format

Todas las APIs REST retornan:

```typescript
// Success
{
  "success": true,
  "data": T,
  "meta": { "page": 1, "limit": 20, "total": 100 }  // solo en listas
}

// Error
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User with id xxx not found",
    "details": []
  }
}
```
