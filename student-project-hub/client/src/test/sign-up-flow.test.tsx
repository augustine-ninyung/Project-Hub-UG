import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '@/pages/auth/login-page';
import RegisterPage from '@/pages/auth/register-page';
import NewProjectPage from '@/pages/new-project-page';
import { authService } from '@/services/auth.service';
import { renderWithProviders, testUser } from './utils';

vi.mock('@/services/auth.service', () => ({
  authService: { me: vi.fn(), login: vi.fn(), logout: vi.fn(), register: vi.fn(), resendVerification: vi.fn() },
}));

const notConfirmed = new AxiosError('Confirm your email first', '403', undefined, undefined, {
  status: 403,
  statusText: '',
  headers: {},
  config: { headers: new AxiosHeaders() },
  data: { success: false, error: { code: 'EMAIL_NOT_VERIFIED', message: 'Confirm your email first.' } },
});

describe('Signing up', () => {
  beforeEach(() => vi.clearAllMocks());

  it('asks the student to check their email instead of signing them in', async () => {
    vi.mocked(authService.register).mockResolvedValue({ email: 'kofi@example.edu' });
    const { queryClient } = renderWithProviders(<RegisterPage />, { user: null });

    await userEvent.type(screen.getByLabelText(/Full name/), 'Kofi Boateng');
    await userEvent.type(screen.getByLabelText(/Username/), 'kofi_b');
    await userEvent.type(screen.getByLabelText(/^Email/), 'kofi@example.edu');
    await userEvent.type(screen.getByLabelText(/University/), 'University of Ghana');
    await userEvent.type(screen.getByLabelText(/Department/), 'Economics');
    await userEvent.type(screen.getByLabelText(/^Password/), 'Password123');
    await userEvent.type(screen.getByLabelText(/Confirm password/), 'Password123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Almost there')).toBeInTheDocument();
    expect(screen.getByText('kofi@example.edu')).toBeInTheDocument();
    expect(screen.getByText('2. Wait for approval')).toBeInTheDocument();
    expect(queryClient.getQueryData(['auth', 'me'])).toBeNull();

    vi.mocked(authService.resendVerification).mockResolvedValue(undefined);
    await userEvent.click(screen.getByRole('button', { name: 'Send a new link' }));
    expect(authService.resendVerification).toHaveBeenCalledWith('kofi@example.edu');
    expect(await screen.findByRole('button', { name: 'New link sent' })).toBeDisabled();
  });

  it('offers a new link when signing in before confirming', async () => {
    vi.mocked(authService.login).mockRejectedValue(notConfirmed);
    vi.mocked(authService.resendVerification).mockResolvedValue(undefined);
    renderWithProviders(<LoginPage />, { user: null });

    await userEvent.type(screen.getByLabelText('Email or username'), 'kofi_b');
    await userEvent.type(screen.getByLabelText('Password'), 'Password123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Confirm your email to sign in')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send a new link' }));
    await waitFor(() => expect(authService.resendVerification).toHaveBeenCalledWith('kofi_b'));
  });

  it('tells a student who is not approved yet why they cannot upload', () => {
    renderWithProviders(<NewProjectPage />, { user: { ...testUser, approved: false } });
    expect(screen.getByText('Waiting for approval')).toBeInTheDocument();
  });
});
