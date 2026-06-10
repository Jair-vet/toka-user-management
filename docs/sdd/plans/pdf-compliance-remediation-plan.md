# Plan de Cumplimiento PDF — Toka Full-Stack IA

Fecha: 2026-06-09

Base de evaluación:
- `Prueba_Tecnica_Desarrollador_Fullstack IA.pdf`
- `AGENTS.md` — SDD Constitution
- Código actual del monorepo

## 1. Diagnóstico Ejecutivo

El proyecto ya cubre la estructura principal solicitada por el PDF: microservicios NestJS, frontend React, Docker Compose, Keycloak OIDC, PostgreSQL/MongoDB/Redis/RabbitMQ/Qdrant, BFF y servicio IA con LangGraph/RAG.

El estado actual es funcionalmente avanzado, pero todavía no está listo para entregar como prueba técnica completa. Las brechas principales están en:

1. Validación runtime completa de Docker.
2. Autenticación distribuida más estricta.
3. Separación real de Clean Architecture mediante repository ports.
4. Consistencia entre endpoints reales, frontend y smoke tests.
5. Coverage verificable por servicio.
6. Seguridad OWASP declarada pero no totalmente implementada en BFF.
7. Logging estructurado uniforme.
8. Documentación final con evidencias de ejecución.

## 2. Hallazgos Por Criterio Del PDF

| Criterio | Estado | Evidencia | Brecha |
|---|---:|---|---|
| Cumplimiento funcional de microservicios | Parcial alto | Auth/User/Role/Audit/BFF/AI existen | Falta validar flujo completo: login, user CRUD, roles, audit, chat, ingest |
| ORM y acceso a datos | Parcial | TypeORM/Mongoose configurados; `synchronize: false` | Use cases inyectan `Repository`/`Model` directamente; faltan ports/adapters |
| Código limpio, seguro, SOLID | Parcial | DTOs, guards, módulos, servicios separados | Algunas responsabilidades mezcladas; errores manuales; eventos inline |
| DDD + Clean Architecture | Parcial | `domain/application/infrastructure/presentation` existen | Domain entities no gobiernan todos los cambios; repositorios de dominio faltan |
| Comunicación sync/async | Parcial alto | REST/BFF + RabbitMQ exchanges y audit consumer | Hay colas declaradas sin consumers claros; smoke y endpoints no coinciden en algunos paths |
| Independencia/desacoplamiento | Parcial | Servicios separados por puerto y DB | Dependencias cruzadas por contratos no formalizados; falta OpenAPI/contracts |
| Autenticación distribuida | Parcial | Keycloak, JWKS, Redis blacklist | JWT no valida issuer/audience; BFF solo verifica presencia de token; registro no sincroniza User DB |
| Tests coverage adecuado | Parcial | Jest/pytest/vitest tests existen | No hay evidencia de coverage generado; BFF sin threshold; deps locales incompletas |
| Dockerización funcional | Parcial alto | Compose completo con healthchecks | Requiere rebuild y validación; health/smoke tienen desalineaciones |
| Logging estructurado | Parcial | Logs tipo objeto en Nest y JSON básico en FastAPI | No hay logger JSON uniforme ni correlation id en todos los logs |
| OWASP | Parcial | Helmet, CORS, ValidationPipe, cookies HttpOnly | CSRF no conectado, rate limit no aplicado en BFF, secrets dev en docs/realm |
| Frontend | Parcial alto | React, Zustand, protected routes, design system | Endpoints frontend no coinciden 100% con backend; faltan tests UI suficientes |
| IA/RAG/agentes | Alto | LangGraph supervisor + RAG + Qdrant + metrics | Requiere API key, rate limiting/retry/cost controls y ejemplos documentados |

## 3. Plan SDD De Remediación

### Fase 0 — Estabilización Para Levantar Localmente

Objetivo: que `npm run docker:up` levante todos los servicios y que `docker compose ps` quede healthy.

Tareas:
- T0.1 Revisar `docker/docker-compose.yml` contra los Dockerfiles actuales.
- T0.2 Alinear todos los healthchecks con endpoints reales:
  - Auth: `/auth/health`
  - User: `/users/health`
  - Role: `/roles/health`
  - Audit: `/audit/health`
  - BFF: `/health`
  - AI: `/health`
- T0.3 Alinear Keycloak realm, credenciales de README y smoke test.
- T0.4 Confirmar que `docker/postgres/init.sql` crea correctamente DB `keycloak`, schemas y seed data.
- T0.5 Ajustar `scripts/smoke-test.sh` para endpoints reales y credenciales reales.
- T0.6 Agregar guía de arranque limpia: build, up, ps, logs puntuales, smoke test.

Criterio de aceptación:
- `npm run docker:up` termina sin `unhealthy`.
- `docker compose -f docker/docker-compose.yml ps` muestra servicios healthy/running.
- `bash scripts/smoke-test.sh` ejecuta el flujo base.

### Fase 1 — Funcionalidad De Microservicios

Objetivo: cerrar flujos mínimos evaluables.

Tareas:
- T1.1 Auth: sincronizar `register` con User Service o publicar `auth.user.registered` consumible.
- T1.2 User: publicar `user.updated` y `user.deleted` reales, no solo log.
- T1.3 Role: reemplazar eventos inline por clases `RoleCreatedEvent` y `RoleRevokedEvent`.
- T1.4 Role: corregir endpoints frontend/smoke para revoke y user roles.
- T1.5 Audit: asegurar idempotencia por `eventId` con índice único.
- T1.6 BFF: agregar agregaciones útiles para dashboard: counts, recent audit, service health.

Criterio de aceptación:
- CRUD usuarios completo.
- Asignación/revocación de roles completa.
- Audit registra eventos de Auth/User/Role.
- Dashboard consume datos reales.

### Fase 2 — Clean Architecture + DDD Real

Objetivo: que la estructura no sea solo carpetas, sino dependencias correctas.

Tareas:
- T2.1 Crear repository ports:
  - `UserRepositoryPort`
  - `RoleRepositoryPort`
  - `PermissionRepositoryPort`
  - `UserRoleRepositoryPort`
  - `AuditEventRepositoryPort`
- T2.2 Crear adapters TypeORM/Mongoose en infrastructure.
- T2.3 Cambiar application services para depender de interfaces/tokens, no de `Repository<T>`.
- T2.4 Usar entidades de dominio para operaciones de negocio:
  - `User.create`
  - `User.updateProfile`
  - `User.softDelete`
  - `Role.assignToUser`
- T2.5 Agregar value objects donde aplica:
  - `Email`
  - `RoleName`
  - `PermissionKey`
- T2.6 Centralizar mapping ORM ↔ domain ↔ DTO.

Criterio de aceptación:
- `application/` no importa TypeORM/Mongoose.
- `domain/` no importa NestJS ni infrastructure.
- Casos de uso se prueban con ports mockeados.

### Fase 3 — Autenticación Distribuida Y Seguridad

Objetivo: OIDC distribuido real, seguro y demostrable.

Tareas:
- T3.1 Fortalecer `JwtGuard`:
  - validar `issuer`
  - validar `audience` o `azp`
  - validar `token_use`/claims esperados
  - manejar JWKS errors con logs claros
- T3.2 Reemplazar BFF `JwtGuard` de presencia por validación real o usar shared-kernel.
- T3.3 Implementar CSRF real en BFF:
  - middleware `csurf`
  - cookie/token double submit
  - interceptor axios frontend para `X-CSRF-Token`
- T3.4 Implementar rate limiting real:
  - Redis-backed limiter por usuario/IP
  - endpoints sensibles: login, refresh, chat, ingest
- T3.5 Revisar Keycloak admin flow:
  - usar admin user env vars o service account con roles correctos
  - no depender de cliente backend en `master` si no tiene permisos admin
- T3.6 Sanitización y validación:
  - `forbidNonWhitelisted: true` en todos los Nest services
  - límites de tamaño en payloads
  - validación de fechas/query params
- T3.7 Quitar secretos dev de documentación principal o marcarlos claramente como locales.

Criterio de aceptación:
- Servicios rechazan tokens de otro issuer/audience.
- BFF protege mutaciones con CSRF.
- Login/chat/ingest tienen rate limiting.
- No hay secretos productivos en código.

### Fase 4 — Comunicación Entre Microservicios

Objetivo: sync/async bien implementado y rastreable.

Tareas:
- T4.1 Documentar contratos REST reales con Swagger/OpenAPI por servicio.
- T4.2 Agregar clients typed en BFF para Auth/User/Role/Audit/AI.
- T4.3 Alinear RabbitMQ:
  - exchange DLX: usar un solo nombre consistente (`dlx.events` o `toka.dlx`)
  - consumers para colas declaradas o eliminar colas no usadas
  - retry/DLX documentado
- T4.4 Propagar `X-Correlation-Id` en BFF y tools de IA.
- T4.5 Agregar contract tests básicos para endpoints críticos.

Criterio de aceptación:
- Cada evento publicado tiene consumidor esperado o justificación.
- Audit puede probar trazabilidad por `correlationId`.
- BFF no tiene paths desalineados con backend.

### Fase 5 — Logging Y Observabilidad

Objetivo: logs JSON consistentes y útiles para el ejercicio de diagnóstico.

Tareas:
- T5.1 Implementar logger JSON compartido en `shared-kernel`.
- T5.2 Inyectar service name, correlationId, action, userId cuando exista.
- T5.3 Reemplazar logs string por objetos normalizados.
- T5.4 Agregar exception filter global con formato API estándar.
- T5.5 Agregar métricas IA:
  - latency
  - estimated token cost
  - model
  - agent path
  - errors/rate limits

Criterio de aceptación:
- Logs de todos los servicios tienen formato JSON.
- Errores REST usan `{ success:false, error:{...} }`.
- IA guarda métricas útiles en MongoDB.

### Fase 6 — Frontend Y Design System

Objetivo: UI funcional, integrada y evaluable.

Tareas:
- T6.1 Alinear tipos frontend con respuestas reales:
  - paginación `{ data, meta }`
  - status enum backend `ACTIVE/INACTIVE/SUSPENDED/PENDING`
  - audit fields `actor/action/resource`
- T6.2 Corregir endpoints:
  - user roles
  - revoke role
  - audit filters
- T6.3 Integrar design system en todas las páginas, no solo declararlo.
- T6.4 Agregar estados completos:
  - loading
  - empty
  - error
  - optimistic updates donde aplique
- T6.5 Agregar tests UI:
  - login redirect
  - protected routes
  - user table actions
  - chat streaming

Criterio de aceptación:
- Flujo login → dashboard → users/roles/audit/chat funciona desde browser.
- Design system se usa consistentemente.
- Vitest genera coverage.

### Fase 7 — IA, RAG Y Supervisor De Agentes

Objetivo: cumplir ejercicio 5 con evidencia, no solo código.

Tareas:
- T7.1 Documentar arquitectura de agentes:
  - supervisor
  - frontend agent
  - backend agent
  - database agent
  - rag/report/admin agents
- T7.2 Agregar fallback si `OPENAI_API_KEY` falta:
  - health degraded
  - mensaje claro
  - no romper todo el stack
- T7.3 Agregar retries/timeouts/rate-limit para OpenAI.
- T7.4 Guardar `agent_outputs` y `agent_path` en métricas.
- T7.5 Crear dataset pequeño de documentos para ingest demo.
- T7.6 Crear ejemplos de prompts y respuestas en docs.

Criterio de aceptación:
- `/ai/documents/ingest` indexa en Qdrant.
- `/ai/chat` responde con RAG o tools según intent.
- Métricas muestran latencia/costo aproximado.

### Fase 8 — Tests Y Coverage

Objetivo: llegar a coverage mínimo 70% por servicio con reporte comprobable.

Tareas:
- T8.1 Reparar instalación local:
  - `npm install`
  - asegurar `turbo` en lockfile/root deps
  - setup Python para AI service
- T8.2 Añadir coverage thresholds faltantes:
  - BFF
  - frontend
  - shared-kernel
- T8.3 Unit tests:
  - auth service
  - user service
  - role service
  - audit service
  - bff service
  - shared-kernel guards/cache/events
  - ai-agent service
- T8.4 Integration tests:
  - User + PostgreSQL
  - Audit + RabbitMQ + MongoDB
  - Auth + Keycloak mocked or testcontainer
- T8.5 E2E smoke:
  - docker stack
  - login
  - CRUD
  - RBAC
  - audit
  - AI ingest/chat

Criterio de aceptación:
- `npm run test:coverage` genera reportes.
- `pytest --cov=src` genera reporte AI.
- Coverage >= 70% por servicio.

### Fase 9 — Dockerización Final Y Entrega

Objetivo: entregar un sistema que el evaluador pueda correr sin adivinar.

Tareas:
- T9.1 Crear `.env.example` coherente con compose.
- T9.2 Corregir README:
  - credenciales reales locales
  - tiempos esperados de arranque
  - comandos exactos
  - troubleshooting Keycloak/Qdrant
- T9.3 Crear `docs/runbook-local.md`.
- T9.4 Crear `docs/evaluation-mapping.md` con tabla PDF → evidencia.
- T9.5 Ejecutar build/test/smoke y guardar resultados en docs.

Criterio de aceptación:
- Un evaluador puede correr:
  - `cp .env.example docker/.env`
  - editar `OPENAI_API_KEY`
  - `npm run docker:up`
  - `docker compose -f docker/docker-compose.yml ps`
  - `bash scripts/smoke-test.sh`
- La documentación explica qué hacer si Keycloak tarda o si IA no tiene API key.

## 4. Orden Recomendado De Ejecución

1. Fase 0 — estabilizar Docker.
2. Fase 1 — cerrar funcionalidad real.
3. Fase 3 — asegurar autenticación/OWASP.
4. Fase 4 — alinear contratos sync/async.
5. Fase 2 — refactor Clean Architecture profundo.
6. Fase 6 — pulir frontend.
7. Fase 7 — fortalecer IA/RAG.
8. Fase 8 — coverage.
9. Fase 9 — documentación final.

## 5. Riesgos Actuales Prioritarios

1. Keycloak puede levantar pero los flujos admin/register pueden fallar por permisos del token admin.
2. `OPENAI_API_KEY` vacío puede degradar el servicio IA y bloquear smoke tests.
3. `scripts/smoke-test.sh` usa credenciales/endpoints que no coinciden completamente con el realm y controladores actuales.
4. El README lista credenciales inconsistentes con `realm-export.json`.
5. `npm run build/test` local no corre si no se reinstalan dependencias de root correctamente.
6. La app parece cumplir DDD en estructura, pero no aún en dependencias de código.

## 6. Definition Of Done Global

El proyecto estará listo para entrega cuando existan estas evidencias:

- Docker stack healthy.
- Smoke test exitoso.
- Coverage report >= 70% por servicio.
- README actualizado con comandos exactos.
- `docs/evaluation-mapping.md` mapea cada criterio del PDF a archivos/evidencias.
- Logs JSON con correlation ID.
- Seguridad OIDC/OWASP validada.
- Flujo IA/RAG documentado con ejemplo reproducible.
