FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json turbo.json tsconfig.base.json ./
COPY packages/shared-kernel/package.json ./packages/shared-kernel/
COPY services/audit-service/package.json ./services/audit-service/
RUN npm install --workspace=packages/shared-kernel --workspace=services/audit-service
COPY packages/shared-kernel ./packages/shared-kernel
COPY services/audit-service ./services/audit-service
RUN npm run build --workspace=packages/shared-kernel
RUN npm run build --workspace=services/audit-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared-kernel/dist ./packages/shared-kernel/dist
COPY --from=builder /app/packages/shared-kernel/package.json ./packages/shared-kernel/
COPY --from=builder /app/services/audit-service/dist ./services/audit-service/dist
COPY --from=builder /app/services/audit-service/package.json ./services/audit-service/
RUN npm install --omit=dev --workspace=services/audit-service
WORKDIR /app/services/audit-service
EXPOSE 3004
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3004/audit/health || exit 1
CMD ["node", "dist/services/audit-service/src/main.js"]
