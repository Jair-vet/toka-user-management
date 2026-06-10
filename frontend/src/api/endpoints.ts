import { httpClient } from './httpClient';

// Users
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  email: string;
  firstName: string;
  lastName: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const usersApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    httpClient.get<PaginatedResponse<User>>('/api/users', { params }),
  get: (id: string) => httpClient.get<User>(`/api/users/${id}`),
  create: (dto: CreateUserDto) => httpClient.post<User>('/api/users', dto),
  update: (id: string, dto: UpdateUserDto) => httpClient.patch<User>(`/api/users/${id}`, dto),
  delete: (id: string) => httpClient.delete(`/api/users/${id}`),
  assignRole: (userId: string, roleId: string) =>
    httpClient.post(`/api/roles/${roleId}/assign`, { userId }),
};

// Roles
export interface Role {
  id: string;
  name: string;
  description: string;
  isSystem?: boolean;
  permissions: Permission[];
  createdAt: string;
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
}

export interface UserRoleAssignment {
  userId: string;
  roleId: string;
  roleName: string;
  assignedAt: string;
}

export interface CreateRoleDto {
  name: string;
  description: string;
  permissionIds?: string[];
}

export const rolesApi = {
  list: () => httpClient.get<Role[]>('/api/roles'),
  get: (id: string) => httpClient.get<Role>(`/api/roles/${id}`),
  create: (dto: CreateRoleDto) => httpClient.post<Role>('/api/roles', dto),
  update: (id: string, dto: Partial<CreateRoleDto>) =>
    httpClient.patch<Role>(`/api/roles/${id}`, dto),
  delete: (id: string) => httpClient.delete(`/api/roles/${id}`),
  permissions: () => httpClient.get<Permission[]>('/api/roles/permissions'),
  userRoles: (userId: string) =>
    httpClient.get<UserRoleAssignment[]>(`/api/roles/users/${userId}`),
  revoke: (userId: string, roleId: string) =>
    httpClient.delete(`/api/roles/${roleId}/users/${userId}`),
};

// Audit
export interface AuditEvent {
  id: string;
  eventId: string;
  action: string;
  actor: string;
  actorEmail?: string;
  resource: string;
  resourceId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export const auditApi = {
  events: (params?: {
    actor?: string;
    resource?: string;
    action?: string;
    resourceId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) => httpClient.get<PaginatedResponse<AuditEvent>>('/api/audit/events', { params }),
};

// AI Chat
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sessionId?: string;
  intent?: string;
  latencyMs?: number;
}

export interface ChatRequest {
  message: string;
  session_id?: string;
}

export interface ChatResponse {
  answer: string;
  session_id: string;
  intent: string;
  latency_ms: number;
}

export const aiApi = {
  chat: (dto: ChatRequest) => httpClient.post<ChatResponse>('/api/ai/chat', dto),
  ingest: (content: string, sourceType: string, sourceId: string) =>
    httpClient.post('/api/ai/documents/ingest', { content, source_type: sourceType, source_id: sourceId }),
};
