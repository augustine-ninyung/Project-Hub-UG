import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/context/auth-context';
import { authService } from '@/services/auth.service';
import { renderWithProviders } from './utils';

vi.mock('@/services/auth.service', () => ({
  authService: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));

function SessionStatus() {
  const { user, logout } = useAuth();
  return (
    <div>
      <p>{user ? `Signed in as ${user.fullName}` : 'Signed out'}</p>
      {user && <button onClick={() => logout()}>Sign out</button>}
    </div>
  );
}

describe('logout', () => {
  it('shows the signed-out state immediately, without a reload', async () => {
    vi.mocked(authService.logout).mockResolvedValue(undefined);
    renderWithProviders(<SessionStatus />);

    expect(screen.getByText('Signed in as Ama Mensah')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByText('Signed out')).toBeInTheDocument();
    expect(authService.logout).toHaveBeenCalledTimes(1);
  });

  it('signs out locally even if the server request fails', async () => {
    vi.mocked(authService.logout).mockRejectedValue(new Error('offline'));
    renderWithProviders(<SessionStatus />);

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('Signed out')).toBeInTheDocument();
  });
});
