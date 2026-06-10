import axios from 'axios';

export const httpClient = axios.create({
  baseURL: '/',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let csrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const { data } = await axios.get<{ csrfToken: string }>('/auth/csrf-token', { withCredentials: true });
  csrfToken = data.csrfToken;
  return csrfToken;
}

// Correlation ID per request
httpClient.interceptors.request.use(async (config) => {
  config.headers['X-Correlation-Id'] = crypto.randomUUID();
  const method = config.method?.toUpperCase() ?? 'GET';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    config.headers['X-CSRF-Token'] = await getCsrfToken();
  }
  return config;
});

// 401 → redirect to login
httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        // Try to refresh first
        try {
          await axios.post('/auth/refresh', {}, {
            withCredentials: true,
            headers: { 'X-CSRF-Token': await getCsrfToken() },
          });
          return httpClient.request(error.config);
        } catch {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error as Error);
  },
);
