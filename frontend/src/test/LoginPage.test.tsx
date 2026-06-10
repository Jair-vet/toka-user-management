import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { httpClient } from '../api/httpClient';

vi.mock('../api/httpClient', () => ({
  httpClient: {
    post: vi.fn(),
    get: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    fetchMe: vi.fn().mockResolvedValue(undefined),
    setToken: vi.fn(),
  }),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email and password inputs', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('shows error on login failure', async () => {
    const mockPost = vi.mocked(httpClient.post);
    mockPost.mockRejectedValueOnce({
      response: { data: { message: 'Invalid credentials' } },
    });

    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@test.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('navigates to dashboard on success', async () => {
    const mockPost = vi.mocked(httpClient.post);
    mockPost.mockResolvedValueOnce({ data: { accessToken: 'access-token' } });

    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'admin@toka.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'Admin123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/dashboard');
    });
  });
});
