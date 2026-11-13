import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminUsers } from '@/features/admin/admin-users';
import { adminService, type AdminUser } from '@/services/admin.service';
import { renderWithProviders, testUser } from './utils';

vi.mock('@/services/admin.service', () => ({
  adminService: { users: vi.fn(), verifyEmail: vi.fn(), approve: vi.fn(), updateUser: vi.fn(), deleteAccount: vi.fn(), keepAccount: vi.fn() },
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
  approvedAt: null,
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

  it('approves instantly and rolls back if the server refuses', async () => {
    serve([person('kofi', { emailVerifiedAt: new Date().toISOString() })]);
    let reject!: (e: Error) => void;
    vi.mocked(adminService.approve).mockReturnValue(new Promise((_, r) => (reject = r)));
    renderWithProviders(<AdminUsers />, { user: admin });

    const kofi = await screen.findByText('Student kofi');
    expect(within(row('Student kofi')).getByText('Awaiting approval')).toBeInTheDocument();
    await userEvent.click(within(row('Student kofi')).getByRole('button', { name: /Approve/ }));

    // Badge disappears before the server answers.
    expect(within(kofi.closest('tr')!).queryByText('Awaiting approval')).not.toBeInTheDocument();
    expect(adminService.approve).toHaveBeenCalledWith('kofi');

    reject(new Error('network'));
    await waitFor(() => expect(within(row('Student kofi')).getByText('Awaiting approval')).toBeInTheDocument());
  });

  it("can't approve a student who hasn't confirmed their email", async () => {
    serve([person('esi')]);
    renderWithProviders(<AdminUsers />, { user: admin });

    await screen.findByText('Student esi');
    expect(within(row('Student esi')).getByText('Email not confirmed')).toBeInTheDocument();
    expect(within(row('Student esi')).queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument();
    expect(within(row('Student esi')).getByRole('button', { name: /Confirm email/ })).toBeInTheDocument();
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

  it('approves several selected students at once', async () => {
    const confirmed = { emailVerifiedAt: new Date().toISOString() };
    serve([
      person('a1', confirmed),
      person('a2', confirmed),
      person('done', { ...confirmed, approvedAt: new Date().toISOString() }),
      person('new'),
    ]);
    vi.mocked(adminService.approve).mockResolvedValue(undefined);
    renderWithProviders(<AdminUsers />, { user: admin });

    await screen.findByText('Student a1');
    // Only students waiting for approval can be selected.
    expect(within(row('Student done')).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(within(row('Student new')).queryByRole('checkbox')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select everyone awaiting approval on this page' }));
    await userEvent.click(screen.getByRole('button', { name: /Approve selected/ }));

    await waitFor(() => expect(adminService.approve).toHaveBeenCalledTimes(2));
    expect(vi.mocked(adminService.approve).mock.calls.map((c) => c[0]).sort()).toEqual(['a1', 'a2']);
  });

  it('opens the details panel when a student is clicked', async () => {
    serve([person('yaw')]);
    renderWithProviders(<AdminUsers />, { user: admin });

    await userEvent.click(await screen.findByRole('button', { name: /Student yaw/ }));
    const panel = await screen.findByRole('dialog');
    expect(within(panel).getByText('yaw@example.edu')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /Confirm email for them/ })).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: /Approve account/ })).not.toBeInTheDocument();
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

describe('Deleting suspended accounts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers permanent deletion for suspended students only', async () => {
    serve([person('susp', { status: 'SUSPENDED' }), person('act', { emailVerifiedAt: new Date().toISOString() })]);
    vi.mocked(adminService.deleteAccount).mockResolvedValue(undefined);
    renderWithProviders(<AdminUsers />, { user: admin });

    await userEvent.click(await screen.findByRole('button', { name: /Student act/ }));
    let panel = await screen.findByRole('dialog');
    expect(within(panel).queryByRole('button', { name: /Delete account permanently/ })).not.toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Close' }));

    await userEvent.click(await screen.findByRole('button', { name: /Student susp/ }));
    panel = await screen.findByRole('dialog');
    await userEvent.click(within(panel).getByRole('button', { name: /Delete account permanently/ }));

    const confirm = await screen.findByRole('dialog', { name: /Permanently delete @susp/ });
    expect(within(confirm).getByText(/This account is suspended/)).toBeInTheDocument();
    await userEvent.type(within(confirm).getByLabelText(/Type susp to confirm/), 'susp');
    await userEvent.click(within(confirm).getByRole('button', { name: /Delete permanently/ }));
    expect(adminService.deleteAccount).toHaveBeenCalledWith('susp');
  });
});
