FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json turbo.json tsconfig.base.json ./
COPY packages/shared-kernel/package.json ./packages/shared-kernel/
COPY services/role-service/package.json ./services/role-service/
RUN npm install --workspace=packages/shared-kernel --workspace=services/role-service
COPY packages/shared-kernel ./packages/shared-kernel
COPY services/role-service ./services/role-service
RUN npm run build --workspace=packages/shared-kernel
RUN npm run build --workspace=services/role-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared-kernel/dist ./packages/shared-kernel/dist
COPY --from=builder /app/packages/shared-kernel/package.json ./packages/shared-kernel/
COPY --from=builder /app/services/role-service/dist ./services/role-service/dist
COPY --from=builder /app/services/role-service/package.json ./services/role-service/
RUN npm install --omit=dev --workspace=services/role-service
WORKDIR /app/services/role-service
EXPOSE 3003
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3003/roles/health || exit 1
CMD ["node", "dist/services/role-service/src/main.js"]
