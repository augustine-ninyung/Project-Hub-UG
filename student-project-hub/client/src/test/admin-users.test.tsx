import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminUsers } from '@/features/admin/admin-users';
import { adminService, type AdminUser } from '@/services/admin.service';
import { renderWithProviders, testUser } from './utils';

vi.mock('@/services/admin.service', () => ({
  adminService: { users: vi.fn(), verifyEmail: vi.fn(), updateUser: vi.fn(), deleteAccount: vi.fn(), keepAccount: vi.fn() },
}));
vi.mock('@/services/user.service', () => ({
  userService: { profile: vi.fn(() => new Promise(() => {})) },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const admin = { ...testUser, id: 'admin1', role: 'ADMIN' as const };

const person = (id: string, over: Partial<AdminUser> = {}): AdminUser => ({
  id,
  username: id,
  fullName: `Student ${id}`,
  avatarUrl: null,
  university: 'University of Ghana',
  department: 'Computer Science',
  email: `${id}@example.edu`,
  role: 'STUDENT',
  status: 'ACTIVE',
  emailVerifiedAt: null,
  deletionRequestedAt: null,
  deletionReason: null,
  lastActiveAt: null,
  createdAt: new Date().toISOString(),
  _count: { projects: 0, comments: 0 },
  ...over,
});

function serve(items: AdminUser[]) {
  vi.mocked(adminService.users).mockResolvedValue({
    items,
    meta: { page: 1, limit: 20, total: items.length, totalPages: 1 },
  });
}

const row = (name: string) => screen.getByText(name).closest('tr')!;

describe('Admin students tab', () => {
  beforeEach(() => vi.clearAllMocks());

  it('verifies instantly and rolls back if the server refuses', async () => {
    serve([person('kofi')]);
    let reject!: (e: Error) => void;
    vi.mocked(adminService.verifyEmail).mockReturnValue(new Promise((_, r) => (reject = r)));
    renderWithProviders(<AdminUsers />, { user: admin });

    const kofi = await screen.findByText('Student kofi');
    await userEvent.click(within(row('Student kofi')).getByRole('button', { name: /Verify/ }));

    // Badge disappears before the server answers.
    expect(within(kofi.closest('tr')!).queryByText('Unverified')).not.toBeInTheDocument();

    reject(new Error('network'));
    await waitFor(() => expect(within(row('Student kofi')).getByText('Unverified')).toBeInTheDocument());
  });

  it('asks for confirmation before making someone an admin', async () => {
    serve([person('ama', { emailVerifiedAt: new Date().toISOString() })]);
    vi.mocked(adminService.updateUser).mockResolvedValue(undefined);
    renderWithProviders(<AdminUsers />, { user: admin });

    await screen.findByText('Student ama');
    await userEvent.click(screen.getByRole('button', { name: 'More actions for @ama' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Make admin/ }));

    expect(adminService.updateUser).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('alertdialog').catch(() => screen.getByRole('dialog'));
    expect(within(dialog).getByText('Make @ama an admin?')).toBeInTheDocument();

    // The server now reports the new role when the list refreshes.
    serve([person('ama', { emailVerifiedAt: new Date().toISOString(), role: 'ADMIN' })]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Make admin' }));
    expect(adminService.updateUser).toHaveBeenCalledWith('ama', { role: 'ADMIN' });
    await waitFor(() => expect(within(row('Student ama')).getByText('Admin')).toBeInTheDocument());
  });

  it('verifies several selected students at once', async () => {
    serve([person('a1'), person('a2'), person('v1', { emailVerifiedAt: new Date().toISOString() })]);
    vi.mocked(adminService.verifyEmail).mockResolvedValue(undefined);
    renderWithProviders(<AdminUsers />, { user: admin });

    await screen.findByText('Student a1');
    // Only unverified students can be selected.
    expect(within(row('Student v1')).queryByRole('checkbox')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all unverified on this page' }));
    await userEvent.click(screen.getByRole('button', { name: /Verify selected/ }));

    await waitFor(() => expect(adminService.verifyEmail).toHaveBeenCalledTimes(2));
    expect(vi.mocked(adminService.verifyEmail).mock.calls.map((c) => c[0]).sort()).toEqual(['a1', 'a2']);
  });

  it('opens the details panel when a student is clicked', async () => {
    serve([person('yaw')]);
    renderWithProviders(<AdminUsers />, { user: admin });

    await userEvent.click(await screen.findByRole('button', { name: /Student yaw/ }));
    const panel = await screen.findByRole('dialog');
    expect(within(panel).getByText('yaw@example.edu')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /Verify email/ })).toBeInTheDocument();
  });
});

describe('Admin deletion requests', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes only after the admin types the username', async () => {
    const requested = person('kwesi', { deletionRequestedAt: new Date().toISOString(), deletionReason: 'Graduated' });
    vi.mocked(adminService.users).mockResolvedValue({
      items: [requested],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    vi.mocked(adminService.deleteAccount).mockResolvedValue(undefined);
    renderWithProviders(<AdminUsers />, { user: admin });

    await screen.findByText('Student kwesi');
    expect(within(row('Student kwesi')).getByText('Deletion requested')).toBeInTheDocument();
    await userEvent.click(within(row('Student kwesi')).getByRole('button', { name: /Delete/ }));

    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: /Delete permanently/ });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Type kwesi to confirm/), 'kwes');
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Type kwesi to confirm/), 'i');
    await userEvent.click(confirm);
    expect(adminService.deleteAccount).toHaveBeenCalledWith('kwesi');
  });
});
