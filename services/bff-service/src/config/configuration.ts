export const configuration = () => ({
  port: parseInt(process.env.PORT || process.env.BFF_PORT || '3005', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  sessionSecret: process.env.SESSION_SECRET || 'bff-session-secret-change-in-prod',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  csrfSecret: process.env.CSRF_SECRET || 'csrf-secret-change-in-prod',
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  keycloak: {
    url: process.env.KEYCLOAK_URL || 'http://localhost:8080',
    publicUrl: process.env.KEYCLOAK_PUBLIC_URL || process.env.KEYCLOAK_URL || 'http://localhost:8080',
    realm: process.env.KEYCLOAK_REALM || 'toka',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'toka-frontend',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
    redirectUri: process.env.KEYCLOAK_REDIRECT_URI || 'http://localhost/auth/callback',
  },
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:3000',
    user: process.env.USER_SERVICE_URL || 'http://user-service:3001',
    role: process.env.ROLE_SERVICE_URL || 'http://role-service:3002',
    audit: process.env.AUDIT_SERVICE_URL || 'http://audit-service:3003',
    ai: process.env.AI_SERVICE_URL || process.env.AI_AGENT_SERVICE_URL || 'http://ai-agent-service:8000',
  },
  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
  },
  logLevel: process.env.LOG_LEVEL || 'info',
});
