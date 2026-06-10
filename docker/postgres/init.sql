-- ===========================
-- Toka User Management System
-- PostgreSQL Initialization
-- ===========================

-- Create Keycloak user and database
CREATE USER keycloak_user WITH PASSWORD 'keycloak_secret_pass';
CREATE DATABASE keycloak OWNER keycloak_user;
GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak_user;

-- Create schemas in toka_main
\c toka_main;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS roles;

GRANT ALL ON SCHEMA auth TO toka_user;
GRANT ALL ON SCHEMA users TO toka_user;
GRANT ALL ON SCHEMA roles TO toka_user;

-- ===========================
-- AUTH SCHEMA
-- ===========================

CREATE TABLE IF NOT EXISTS auth.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_info JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_sessions_user_id ON auth.sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON auth.sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(512) UNIQUE NOT NULL,
  user_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON auth.refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON auth.refresh_tokens(token);

-- ===========================
-- USERS SCHEMA
-- ===========================

CREATE TYPE users.user_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING');

CREATE TABLE IF NOT EXISTS users.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  status users.user_status DEFAULT 'PENDING',
  avatar_url TEXT,
  keycloak_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users.users(email);
CREATE INDEX idx_users_status ON users.users(status);
CREATE INDEX idx_users_keycloak_id ON users.users(keycloak_id);
CREATE INDEX idx_users_deleted_at ON users.users(deleted_at) WHERE deleted_at IS NULL;

-- ===========================
-- ROLES SCHEMA
-- ===========================

CREATE TABLE IF NOT EXISTS roles.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  scope VARCHAR(20) DEFAULT 'GLOBAL',
  description TEXT,
  UNIQUE(resource, action, scope)
);

CREATE TABLE IF NOT EXISTS roles.role_permissions (
  role_id UUID REFERENCES roles.roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES roles.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS roles.user_roles (
  user_id UUID NOT NULL,
  role_id UUID REFERENCES roles.roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON roles.user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON roles.user_roles(role_id);

-- ===========================
-- SEED DATA
-- ===========================

-- Default system roles
INSERT INTO roles.roles (name, description, is_system) VALUES
  ('ADMIN', 'System administrator with full access', TRUE),
  ('USER_MANAGER', 'Can manage users and assign roles', TRUE),
  ('AUDITOR', 'Read-only access to audit logs', TRUE),
  ('VIEWER', 'Basic read access', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Default permissions
INSERT INTO roles.permissions (resource, action, scope, description) VALUES
  ('users', 'read', 'GLOBAL', 'Read any user'),
  ('users', 'write', 'GLOBAL', 'Create and update any user'),
  ('users', 'delete', 'GLOBAL', 'Delete any user'),
  ('users', 'manage', 'GLOBAL', 'Full user management'),
  ('users', 'read', 'OWN', 'Read own profile'),
  ('users', 'write', 'OWN', 'Update own profile'),
  ('roles', 'read', 'GLOBAL', 'Read roles and permissions'),
  ('roles', 'write', 'GLOBAL', 'Create and update roles'),
  ('roles', 'assign', 'GLOBAL', 'Assign roles to users'),
  ('audit', 'read', 'GLOBAL', 'Read audit logs'),
  ('ai', 'chat', 'GLOBAL', 'Use AI assistant'),
  ('ai', 'ingest', 'GLOBAL', 'Ingest documents into AI system')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- Assign all permissions to ADMIN role
INSERT INTO roles.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles.roles r, roles.permissions p
WHERE r.name = 'ADMIN'
ON CONFLICT DO NOTHING;

-- USER_MANAGER permissions
INSERT INTO roles.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles.roles r, roles.permissions p
WHERE r.name = 'USER_MANAGER'
  AND (p.resource IN ('users', 'roles') AND p.action IN ('read', 'write', 'assign'))
ON CONFLICT DO NOTHING;

-- AUDITOR permissions
INSERT INTO roles.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles.roles r, roles.permissions p
WHERE r.name = 'AUDITOR'
  AND (p.resource = 'audit' AND p.action = 'read')
   OR (p.resource = 'users' AND p.action = 'read')
ON CONFLICT DO NOTHING;

-- VIEWER permissions
INSERT INTO roles.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles.roles r, roles.permissions p
WHERE r.name = 'VIEWER'
  AND p.scope = 'OWN'
  OR (p.resource = 'ai' AND p.action = 'chat')
ON CONFLICT DO NOTHING;
