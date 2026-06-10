FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json turbo.json tsconfig.base.json ./
COPY packages/shared-kernel/package.json ./packages/shared-kernel/
COPY services/user-service/package.json ./services/user-service/
RUN npm install --workspace=packages/shared-kernel --workspace=services/user-service
COPY packages/shared-kernel ./packages/shared-kernel
COPY services/user-service ./services/user-service
RUN npm run build --workspace=packages/shared-kernel
RUN npm run build --workspace=services/user-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared-kernel/dist ./packages/shared-kernel/dist
COPY --from=builder /app/packages/shared-kernel/package.json ./packages/shared-kernel/
COPY --from=builder /app/services/user-service/dist ./services/user-service/dist
COPY --from=builder /app/services/user-service/package.json ./services/user-service/
RUN npm install --omit=dev --workspace=services/user-service
WORKDIR /app/services/user-service
EXPOSE 3002
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3002/users/health || exit 1
CMD ["node", "dist/services/user-service/src/main.js"]
