import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { httpClient } from '@/api/httpClient';

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  given_name?: string;
  family_name?: string;
  realm_access?: { roles: string[] };
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;

  login: () => void;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  setToken: (token: string) => void;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      accessToken: null,

      login: () => {
        window.location.href = '/auth/login';
      },

      logout: async () => {
        try {
          await httpClient.post('/auth/logout');
        } catch {
          // ignore
        }
        set({ user: null, isAuthenticated: false, accessToken: null });
        window.location.href = '/login';
      },

      fetchMe: async () => {
        set({ isLoading: true });
        try {
          const { data } = await httpClient.get<AuthUser>('/auth/me');
          set({ user: data, isAuthenticated: true });
        } catch {
          set({ user: null, isAuthenticated: false });
        } finally {
          set({ isLoading: false });
        }
      },

      setToken: (token: string) => {
        set({ accessToken: token });
        httpClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      },

      hasRole: (role: string) => {
        const user = get().user;
        return user?.realm_access?.roles?.includes(role) ?? false;
      },
    }),
    {
      name: 'toka-auth',
      partialize: (state: AuthState) => ({ accessToken: state.accessToken }),
    },
  ),
);
