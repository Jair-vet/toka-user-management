FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace package files
COPY package.json turbo.json tsconfig.base.json ./
COPY packages/shared-kernel/package.json ./packages/shared-kernel/
COPY services/auth-service/package.json ./services/auth-service/

RUN npm install --workspace=packages/shared-kernel --workspace=services/auth-service

COPY packages/shared-kernel ./packages/shared-kernel
COPY services/auth-service ./services/auth-service

RUN npm run build --workspace=packages/shared-kernel
RUN npm run build --workspace=services/auth-service

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared-kernel/dist ./packages/shared-kernel/dist
COPY --from=builder /app/packages/shared-kernel/package.json ./packages/shared-kernel/
COPY --from=builder /app/services/auth-service/dist ./services/auth-service/dist
COPY --from=builder /app/services/auth-service/package.json ./services/auth-service/

RUN npm install --omit=dev --workspace=services/auth-service

WORKDIR /app/services/auth-service

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3001/auth/health || exit 1

CMD ["node", "dist/services/auth-service/src/main.js"]
