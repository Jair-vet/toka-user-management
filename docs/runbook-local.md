# Local Runbook

## Objetivo

Levantar el stack Docker local del Toka User Management System y validar que los servicios queden sanos.

## Requisitos

- Docker Desktop corriendo.
- Node.js 20+ si vas a ejecutar builds/tests locales.
- Ollama instalado si usarás IA local gratuita.
- `AI_PROVIDER=litellm` usa el gateway local para routing, costos y observabilidad.

## IA local con Ollama + LiteLLM + Langfuse

Instala Ollama desde el sitio oficial y descarga los modelos:

```bash
ollama pull qwen2.5:7b
ollama pull nomic-embed-text
ollama list
```

En `docker/.env`, deja estas variables para usar Ollama a traves de LiteLLM:

```bash
AI_PROVIDER=litellm
OPENAI_API_KEY=
OPENAI_BASE_URL=http://litellm:4000/v1
LITELLM_MASTER_KEY=sk-toka-master
LITELLM_VIRTUAL_KEY=sk-toka-master
OLLAMA_API_BASE=http://host.docker.internal:11434
LLM_MODEL=toka-chat
EMBEDDING_MODEL=toka-embedding
EMBEDDING_DIMENSIONS=768
QDRANT_COLLECTION=toka_documents_ollama
LANGFUSE_ENABLED=true
LANGFUSE_HOST=http://langfuse-web:3000
LANGFUSE_PUBLIC_KEY=pk-lf-toka-local
LANGFUSE_SECRET_KEY=sk-lf-toka-local
```

Si quieres saltarte LiteLLM temporalmente, puedes volver al modo directo:

```bash
AI_PROVIDER=ollama
OPENAI_API_KEY=
OPENAI_BASE_URL=
OLLAMA_BASE_URL=http://host.docker.internal:11434/v1
LLM_MODEL=qwen2.5:7b
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768
QDRANT_COLLECTION=toka_documents_ollama
```

## Primera ejecución o después de cambios en RabbitMQ/Keycloak

RabbitMQ carga `docker/rabbitmq/definitions.json` solo cuando se inicializa su volumen. Si cambian usuarios, permisos, exchanges o colas, hay que recrear volúmenes.

```bash
cd "/Users/jair/Documents/Desarrollador Full Stack IA"
npm run docker:down
docker compose -f docker/docker-compose.yml down -v
docker compose -f docker/docker-compose.yml build --no-cache
npm run docker:up
```

## Ejecución normal

```bash
cd "/Users/jair/Documents/Desarrollador Full Stack IA"
docker compose -f docker/docker-compose.yml build
npm run docker:up
```

## Verificación

```bash
docker compose -f docker/docker-compose.yml ps
npm run smoke-test
```

## URLs locales

- Frontend: `http://localhost`
- BFF: `http://localhost:3005`
- Keycloak: `http://localhost:8080`
- RabbitMQ Management: `http://localhost:15672`
- Traefik Dashboard: `http://localhost:8090`
- LiteLLM Gateway: `http://localhost:4000`
- Langfuse: `http://localhost:3006`
- MinIO para Langfuse: `http://localhost:9091`
- Open WebUI opcional: `http://localhost:3007`

## Credenciales demo

- App admin: `admin@toka.com` / `Admin123!`
- RabbitMQ: `toka_rabbit` / `toka_rabbit_pass`
- Keycloak admin: `admin` / `admin_secret_pass`
- Langfuse local: `admin@toka.local` / `toka_langfuse_admin`
- Open WebUI local: `admin@toka.local` / `toka_openwebui_admin`

## Prueba de observabilidad LLM

```bash
curl -sS http://localhost:8000/health
curl -sS http://localhost:4000/health/readiness
```

Luego abre `http://localhost`, entra al chat y pregunta:

```text
Explicame la arquitectura del sistema
```

La burbuja de respuesta debe mostrar `trace xxxxxxxx`. Busca ese identificador en Langfuse (`http://localhost:3006`) para revisar prompts, respuestas, latencia, agente elegido y pasos del supervisor.

## Open WebUI opcional

Open WebUI no reemplaza el chat principal. Es una consola interna para probar modelos contra LiteLLM:

```bash
docker compose -f docker/docker-compose.yml --profile ai-lab up -d open-webui
```

## Diagnóstico rápido

```bash
docker logs toka_keycloak --tail 120
docker logs toka_rabbitmq --tail 120
docker logs toka_auth_service --tail 120
docker logs toka_user_service --tail 120
docker logs toka_role_service --tail 120
docker logs toka_audit_service --tail 120
docker logs toka_ai_service --tail 120
docker logs toka_litellm --tail 120
docker logs toka_langfuse_web --tail 120
docker logs toka_langfuse_worker --tail 120
```
