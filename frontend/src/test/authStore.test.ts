import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { httpClient } from '../api/httpClient';

vi.mock('../api/httpClient', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}));

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      accessToken: null,
    });
    vi.clearAllMocks();
  });

  it('fetchMe sets user on success', async () => {
    vi.mocked(httpClient.get).mockResolvedValueOnce({
      data: {
        sub: 'user-123',
        email: 'admin@toka.dev',
        name: 'Admin User',
        realm_access: { roles: ['admin'] },
      },
    });

    await useAuthStore.getState().fetchMe();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe('admin@toka.dev');
  });

  it('fetchMe sets unauthenticated on 401', async () => {
    vi.mocked(httpClient.get).mockRejectedValueOnce(new Error('401'));

    await useAuthStore.getState().fetchMe();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('hasRole returns true for matching role', async () => {
    useAuthStore.setState({
      user: {
        sub: 'u1', email: 'e@e.com', name: 'Test',
        realm_access: { roles: ['admin', 'user'] },
      },
      isAuthenticated: true,
    });

    expect(useAuthStore.getState().hasRole('admin')).toBe(true);
    expect(useAuthStore.getState().hasRole('superuser')).toBe(false);
  });
});
