# SDD Skills, Agents & Routines Declaration

## Skills

Skills son capacidades reutilizables encapsuladas en módulos específicos.

### SK-AUTH-01: jwt-validation
```yaml
id: SK-AUTH-01
name: jwt-validation
description: Validar JWT RS256 via JWKS endpoint de Keycloak + verificar blacklist en Redis
location: packages/shared-kernel/src/infrastructure/jwt/
files:
  - jwt.guard.ts        # NestJS guard — extrae y valida JWT
  - jwt.strategy.ts     # Passport strategy RS256 + JWKS
  - jwt-blacklist.ts    # Redis blacklist check
inputs:
  - Authorization: Bearer <token> header
outputs:
  - req.user: { sub, email, roles, permissions }
used_by: [auth-service, user-service, role-service, audit-service, ai-agent-service]
```

### SK-AUTH-02: oauth-flow
```yaml
id: SK-AUTH-02
name: oauth-flow
description: OIDC authorization code flow con PKCE para frontend
location: services/bff-service/src/auth/
files:
  - oauth.controller.ts   # Inicia flow y maneja callback
  - session.middleware.ts # Sesión server-side con HttpOnly cookies
  - csrf.middleware.ts    # CSRF double-submit cookie
used_by: [bff-service]
```

### SK-USER-01: user-crud
```yaml
id: SK-USER-01
name: user-crud
description: CRUD completo de usuarios con validación y publicación de domain events
location: services/user-service/src/application/use-cases/
files:
  - create-user.use-case.ts
  - update-user.use-case.ts
  - delete-user.use-case.ts
  - get-user.use-case.ts
  - list-users.use-case.ts
used_by: [user-service]
```

### SK-ROLE-01: rbac-enforcement
```yaml
id: SK-ROLE-01
name: rbac-enforcement
description: Verificar permisos del usuario contra jerarquía de roles usando claims del JWT
location: packages/shared-kernel/src/guards/
files:
  - roles.guard.ts          # NestJS guard para @Roles()
  - permissions.guard.ts    # Guard para @Permissions()
  - roles.decorator.ts      # @Roles('ADMIN', 'USER_MANAGER')
  - permissions.decorator.ts # @Permissions('users:write')
used_by: [auth-service, user-service, role-service, audit-service, bff-service]
```

### SK-AUDIT-01: audit-logging
```yaml
id: SK-AUDIT-01
name: audit-logging
description: Persistir audit event en MongoDB desde domain events de RabbitMQ
location: services/audit-service/src/infrastructure/messaging/
files:
  - audit-event.subscriber.ts  # RabbitMQ consumer
  - audit-event.mapper.ts      # Domain event → AuditEvent document
used_by: [audit-service]
```

### SK-AI-01: rag-query
```yaml
id: SK-AI-01
name: rag-query
description: Recuperar documentos relevantes de Qdrant y generar respuesta con LLM
location: services/ai-agent-service/src/agents/
files:
  - rag_agent.py              # LangGraph node
  - tools/vector_search.py    # Tool: Qdrant similarity search
location_rag: services/ai-agent-service/src/rag/
files_rag:
  - retriever.py              # Hybrid retrieval (dense + metadata filter)
  - pipeline.py               # Full RAG chain
used_by: [ai-agent-service]
```

### SK-AI-02: embedding-pipeline
```yaml
id: SK-AI-02
name: embedding-pipeline
description: Chunk + embed + upsert documentos en Qdrant
location: services/ai-agent-service/src/rag/
files:
  - pipeline.py     # Orchestrates full ingestion
  - chunker.py      # Recursive text splitter (512 tokens, 50 overlap)
  - embedder.py     # OpenAI text-embedding-3-small wrapper
used_by: [ai-agent-service]
```

### SK-AI-03: tool-execution
```yaml
id: SK-AI-03
name: tool-execution
description: Ejecutar tools LangChain que realizan llamadas HTTP a microservicios
location: services/ai-agent-service/src/agents/tools/
files:
  - user_lookup.py     # GET /api/users?query=...
  - role_lookup.py     # GET /api/roles/:id
  - audit_search.py    # GET /api/audit/events?...
  - vector_search.py   # Qdrant similarity search
used_by: [ai-agent-service — AG-RPT, AG-ADM]
```

### SK-INFRA-01: event-publishing
```yaml
id: SK-INFRA-01
name: event-publishing
description: Publicar domain events a RabbitMQ con retry y correlation ID
location: packages/shared-kernel/src/infrastructure/rabbitmq/
files:
  - rabbitmq.module.ts    # NestJS dynamic module
  - event-publisher.ts    # Publish con confirm mode
  - event-subscriber.ts   # Subscribe con ack/nack
used_by: [auth-service, user-service, role-service, ai-agent-service]
```

### SK-INFRA-02: cache-management
```yaml
id: SK-INFRA-02
name: cache-management
description: Read/write/invalidate Redis cache con TTL y serialización
location: packages/shared-kernel/src/infrastructure/redis/
files:
  - redis.module.ts    # NestJS dynamic module
  - cache.service.ts   # get, set, del, exists, expire
used_by: [auth-service, user-service, bff-service]
```

---

## Agents

Agents son nodos especializados en el StateGraph de LangGraph (ai-agent-service).

### AG-ORC: Orchestrator
```yaml
id: AG-ORC
name: Orchestrator
node: orchestrator
file: services/ai-agent-service/src/agents/orchestrator.py
description: |
  Nodo inicial del StateGraph. Clasifica el intent del usuario en:
  - "rag": preguntas sobre documentación del sistema
  - "report": generar reporte desde datos vivos
  - "admin": consulta administrativa del sistema
  Delega al agent correcto y sintetiza respuesta final.
state_fields:
  - messages: list of messages (LangChain format)
  - intent: classified intent string
  - context: retrieved documents
  - tool_results: list of tool outputs
  - final_answer: synthesized response
  - metadata: { tokens, latency_ms, cost_usd }
system_prompt: prompts/system_prompts.py::ORCHESTRATOR_PROMPT
```

### AG-RAG: RAG Agent
```yaml
id: AG-RAG
name: RAG Agent
node: rag_agent
file: services/ai-agent-service/src/agents/rag_agent.py
description: |
  Responde preguntas usando documentos recuperados de Qdrant.
  Estrategia: dense retrieval (OpenAI embeddings) + metadata filter.
  NO inventa información — cita fuentes del contexto recuperado.
tools: [SK-AI-01 vector_search]
system_prompt: prompts/system_prompts.py::RAG_AGENT_PROMPT
few_shots: prompts/few_shot_examples.py::RAG_EXAMPLES
```

### AG-RPT: Report Agent
```yaml
id: AG-RPT
name: Report Agent
node: report_agent
file: services/ai-agent-service/src/agents/report_agent.py
description: |
  Genera reportes estructurados sobre usuarios, roles y auditoría.
  Llama a microservicios vía tools para obtener datos actualizados.
  Usa chain-of-thought para análisis de datos.
tools: [SK-AI-03 user_lookup, role_lookup, audit_search]
system_prompt: prompts/system_prompts.py::REPORT_AGENT_PROMPT
chain_of_thought: prompts/chain_of_thought.py::REPORT_COT
```

### AG-ADM: Admin Assistant
```yaml
id: AG-ADM
name: Admin Assistant
node: admin_assistant
file: services/ai-agent-service/src/agents/admin_assistant.py
description: |
  Interfaz de lenguaje natural para administración del sistema.
  Puede responder preguntas como:
  - "¿Cuántos usuarios activos hay?"
  - "¿Qué roles tiene el usuario john@toka.com?"
  - "Muéstrame los últimos 10 eventos de auditoría"
  Combina RAG + tool execution según necesidad.
tools: [SK-AI-01, SK-AI-03 all tools]
system_prompt: prompts/system_prompts.py::ADMIN_ASSISTANT_PROMPT
```

---

## Routines

Routines son workflows que orquestan múltiples skills y agents.

### RT-01: User Onboarding
```yaml
id: RT-01
name: User Onboarding
trigger: POST /api/users (after successful user creation)
steps:
  1. [SK-USER-01] CreateUserUseCase — persiste User en PostgreSQL
  2. [SK-ROLE-01] AssignDefaultRoleUseCase — asigna rol "VIEWER" por defecto
  3. [SK-INFRA-01] Publish user.created event a RabbitMQ
  4. [SK-AUDIT-01] (async) Audit Service consume event → persiste AuditEvent
  5. [SK-AI-02] (async) AI Service consume event → embed perfil de usuario
rollback: Si paso 1 falla, no continuar. Si paso 2 falla, log warning (no crítico).
```

### RT-02: User Deletion
```yaml
id: RT-02
name: User Deletion
trigger: DELETE /api/users/:id
steps:
  1. [SK-USER-01] SoftDeleteUserUseCase — sets deletedAt timestamp
  2. Role Service consume user.deleted → limpia UserRole entries
  3. Auth Service invalida todas las sesiones activas del usuario (Redis)
  4. JWT blacklisted tokens para ese userId
  5. [SK-INFRA-01] Publish user.deleted event
  6. [SK-AUDIT-01] (async) Persiste AuditEvent USER_DELETED
```

### RT-03: Role Assignment
```yaml
id: RT-03
name: Role Assignment
trigger: POST /api/roles/:id/assign { userId }
steps:
  1. Validate role exists (role-service)
  2. Validate user exists (user-service)
  3. AssignRoleUseCase — persiste UserRole
  4. [SK-INFRA-02] Invalidate user:permissions:{userId} cache in Redis
  5. [SK-INFRA-01] Publish role.assigned event
  6. [SK-AUDIT-01] (async) Persiste AuditEvent ROLE_ASSIGNED
```

### RT-04: Document Ingestion
```yaml
id: RT-04
name: Document Ingestion
trigger: POST /api/ai/documents/ingest { content, source_type, source_id }
steps:
  1. Validate JWT (SK-AUTH-01)
  2. [SK-AI-02] chunk document (512 tokens, 50 overlap)
  3. [SK-AI-02] generate embeddings (OpenAI text-embedding-3-small)
  4. [SK-AI-02] upsert vectors to Qdrant collection toka_documents
  5. Store metadata in MongoDB
  6. Return { chunks_created, collection_size }
```

### RT-05: AI Query
```yaml
id: RT-05
name: AI Query
trigger: POST /api/ai/chat { message, session_id }
steps:
  1. Validate JWT (SK-AUTH-01)
  2. Load conversation history from MongoDB
  3. [AG-ORC] classify intent
  4a. If intent == "rag": [AG-RAG] retrieve + generate
  4b. If intent == "report": [AG-RPT] fetch data + format report
  4c. If intent == "admin": [AG-ADM] execute tools + synthesize
  5. Track metrics: latency_ms, input_tokens, output_tokens, cost_usd
  6. Save message + response to conversation history
  7. Stream response via SSE
```
