# Local Runbook

## Objetivo

Levantar el stack Docker local del Toka User Management System y validar que los servicios queden sanos.

## Requisitos

- Docker Desktop corriendo.
- Node.js 20+ si vas a ejecutar builds/tests locales.
- Ollama instalado si usarás IA local gratuita.
- `AI_PROVIDER=ollama` permite usar el asistente sin créditos de OpenAI.

## IA local con Ollama

Instala Ollama desde el sitio oficial y descarga los modelos:

```bash
ollama pull qwen2.5-coder:7b
ollama pull nomic-embed-text
ollama list
```

En `docker/.env`, deja estas variables:

```bash
AI_PROVIDER=ollama
OPENAI_API_KEY=
OPENAI_BASE_URL=
OLLAMA_BASE_URL=http://host.docker.internal:11434/v1
LLM_MODEL=qwen2.5-coder:7b
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

## Credenciales demo

- App admin: `admin@toka.com` / `Admin123!`
- RabbitMQ: `toka_rabbit` / `toka_rabbit_pass`
- Keycloak admin: `admin` / `admin_secret_pass`

## Diagnóstico rápido

```bash
docker logs toka_keycloak --tail 120
docker logs toka_rabbitmq --tail 120
docker logs toka_auth_service --tail 120
docker logs toka_user_service --tail 120
docker logs toka_role_service --tail 120
docker logs toka_audit_service --tail 120
docker logs toka_ai_service --tail 120
```
