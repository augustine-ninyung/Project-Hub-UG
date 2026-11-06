import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '@/pages/auth/login-page';
import { authService } from '@/services/auth.service';
import { renderWithProviders, testUser } from './utils';

vi.mock('@/services/auth.service', () => ({
  authService: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));

function apiError(status: number, message: string, code = 'UNAUTHORIZED') {
  return new AxiosError(message, String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { success: false, error: { code, message } },
  });
}

describe('LoginPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('validates required fields before calling the API', async () => {
    renderWithProviders(<LoginPage />, { user: null });
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter your email or username')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('submits credentials and signs the user in', async () => {
    vi.mocked(authService.login).mockResolvedValue(testUser);
    const { queryClient } = renderWithProviders(<LoginPage />, { user: null });

    await userEvent.type(screen.getByLabelText('Email or username'), 'ama');
    await userEvent.type(screen.getByLabelText('Password'), 'Password123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(authService.login).toHaveBeenCalledWith('ama', 'Password123', false));
    await waitFor(() => expect(queryClient.getQueryData(['auth', 'me'])).toEqual(testUser));
  });

  it('shows the server error message when credentials are wrong', async () => {
    vi.mocked(authService.login).mockRejectedValue(
      apiError(401, 'Invalid email/username or password'),
    );
    renderWithProviders(<LoginPage />, { user: null });

    await userEvent.type(screen.getByLabelText('Email or username'), 'ama');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email/username or password');
  });

  it('offers to keep an account that is waiting to be deleted', async () => {
    vi.mocked(authService.login)
      .mockRejectedValueOnce(apiError(403, 'Deletion pending', 'ACCOUNT_DELETION_PENDING'))
      .mockResolvedValueOnce(testUser);
    renderWithProviders(<LoginPage />, { user: null });

    await userEvent.type(screen.getByLabelText('Email or username'), 'ama');
    await userEvent.type(screen.getByLabelText('Password'), 'Password123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const keep = await screen.findByRole('button', { name: 'Keep my account and sign in' });
    await userEvent.click(keep);
    await waitFor(() => expect(authService.login).toHaveBeenLastCalledWith('ama', 'Password123', true));
  });
});
