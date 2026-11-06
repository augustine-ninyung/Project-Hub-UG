import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  Check,
  ExternalLink,
  MailCheck,
  MoreHorizontal,
  PanelRightOpen,
  Shield,
  ShieldOff,
  Trash2,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Pagination } from '@/components/common/pagination';
import { EmptyState, ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Dialog, SheetContent } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form-controls';
import { Badge, Skeleton, UserAvatar } from '@/components/ui/misc';
import { useAuth } from '@/context/auth-context';
import { adminService, type AdminUser } from '@/services/admin.service';
import { userService } from '@/services/user.service';
import { formatDate, timeAgo } from '@/utils/format';
import { Checkbox, plural, SearchInput, SkeletonRows, Table, useOptimisticRows, useUrlState } from './shared';

const LIST_KEY = ['admin', 'users'] as const;

type Sensitive = { kind: 'role' | 'suspend'; user: AdminUser };

/** All user actions, shared by the table rows and the details panel. */
function useUserActions() {
  const verify = useOptimisticRows<AdminUser, string>({
    listKey: LIST_KEY,
    mutationFn: (id) => adminService.verifyEmail(id),
    apply: (u, id) => (u.id === id ? { ...u, emailVerifiedAt: new Date().toISOString() } : u),
    success: 'Email verified. They can now upload and comment.',
  });
  const update = useOptimisticRows<AdminUser, { id: string; data: { role?: AdminUser['role']; status?: AdminUser['status'] } }>({
    listKey: LIST_KEY,
    mutationFn: ({ id, data }) => adminService.updateUser(id, data),
    apply: (u, { id, data }) => (u.id === id ? { ...u, ...data } : u),
    success: ({ data }) =>
      data.status === 'SUSPENDED'
        ? 'Account suspended and signed out everywhere'
        : data.status === 'ACTIVE'
          ? 'Account reactivated'
          : data.role === 'ADMIN'
            ? 'Admin access granted'
            : 'Admin access removed',
  });
  // Only for students who asked to be deleted (the server enforces this too).
  const deleteAccount = useOptimisticRows<AdminUser, string>({
    listKey: LIST_KEY,
    mutationFn: (id) => adminService.deleteAccount(id),
    apply: (u, id) => (u.id === id ? null : u),
    success: 'Account and all its content permanently deleted',
  });
  const keepAccount = useOptimisticRows<AdminUser, string>({
    listKey: LIST_KEY,
    mutationFn: (id) => adminService.keepAccount(id),
    apply: (u, id) => (u.id === id ? { ...u, deletionRequestedAt: null, deletionReason: null } : u),
    success: 'Request declined. The account works again.',
  });
  return { verify, update, deleteAccount, keepAccount };
}

/**
 * Permanent deletion: the admin types the username, so it can't happen by a
 * stray click.
 */
function DeleteAccountConfirm({
  user,
  onClose,
  onConfirm,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onConfirm: (u: AdminUser) => void;
}) {
  const [typed, setTyped] = useState('');
  useEffect(() => setTyped(''), [user]);
  const matches = typed.trim().toLowerCase() === user?.username;
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader
          title={`Permanently delete @${user?.username}?`}
          description={`${user?.fullName} asked for this. Their account, ${plural(user?._count.projects ?? 0, 'project')}, comments, likes and images are deleted for good. Replies other students left under their comments go too. This cannot be undone.`}
        />
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (user && matches) onConfirm(user);
          }}
        >
          <Field label={`Type ${user?.username ?? ''} to confirm`} htmlFor="confirm-username">
            <Input
              id="confirm-username"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!matches}>
              <Trash2 /> Delete permanently
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadges({ user }: { user: AdminUser }) {
  return (
    <span className="flex flex-wrap gap-1">
      {user.role === 'ADMIN' && <Badge>Admin</Badge>}
      {user.status === 'SUSPENDED' ? (
        <Badge variant="destructive">Suspended</Badge>
      ) : (
        <Badge variant="success">Active</Badge>
      )}
      {!user.emailVerifiedAt && <Badge variant="warning">Unverified</Badge>}
      {user.deletionRequestedAt && <Badge variant="destructive">Deletion requested</Badge>}
    </span>
  );
}

function SensitiveConfirm({
  pending,
  onClose,
  onConfirm,
}: {
  pending: Sensitive | null;
  onClose: () => void;
  onConfirm: (p: Sensitive) => void;
}) {
  const u = pending?.user;
  const makingAdmin = pending?.kind === 'role' && u?.role !== 'ADMIN';
  const copy =
    pending?.kind === 'suspend'
      ? {
          title: `Suspend @${u?.username}?`,
          description:
            'They are signed out on every device straight away and cannot sign in until you reactivate them. Their profile is hidden from other students.',
          label: 'Suspend account',
          destructive: true,
        }
      : makingAdmin
        ? {
            title: `Make @${u?.username} an admin?`,
            description:
              'They will be able to suspend students, remove projects, review reports and manage categories. Only do this for people you trust.',
            label: 'Make admin',
            destructive: false,
          }
        : {
            title: `Remove admin access from @${u?.username}?`,
            description: 'They become a regular student and lose access to this dashboard immediately.',
            label: 'Remove admin access',
            destructive: true,
          };
  return (
    <ConfirmDialog
      open={!!pending}
      onOpenChange={(o) => !o && onClose()}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.label}
      destructive={copy.destructive}
      onConfirm={() => pending && onConfirm(pending)}
    />
  );
}

function RowActions({
  user,
  onOpen,
  onSensitive,
  onDelete,
  actions,
}: {
  user: AdminUser;
  onOpen: () => void;
  onSensitive: (p: Sensitive) => void;
  onDelete: (u: AdminUser) => void;
  actions: ReturnType<typeof useUserActions>;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {user.deletionRequestedAt ? (
        <>
          <Button variant="outline" size="sm" onClick={() => actions.keepAccount.mutate(user.id)}>
            <Undo2 /> Keep
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(user)}>
            <Trash2 /> Delete
          </Button>
        </>
      ) : !user.emailVerifiedAt && (
        <Button variant="outline" size="sm" onClick={() => actions.verify.mutate(user.id)}>
          <MailCheck /> Verify
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`More actions for @${user.username}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onOpen}>
            <PanelRightOpen /> View details
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={`/u/${user.username}`}>
              <ExternalLink /> Public profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onSensitive({ kind: 'role', user })}>
            {user.role === 'ADMIN' ? (
              <>
                <ShieldOff /> Remove admin
              </>
            ) : (
              <>
                <Shield /> Make admin
              </>
            )}
          </DropdownMenuItem>
          {user.status === 'ACTIVE' ? (
            <DropdownMenuItem destructive onSelect={() => onSensitive({ kind: 'suspend', user })}>
              <Ban /> Suspend
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => actions.update.mutate({ id: user.id, data: { status: 'ACTIVE' } })}>
              <Check /> Reactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-lg font-semibold tabular-nums">{value ?? '–'}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Side panel with everything about one student, without leaving the list. */
function UserPanel({
  user,
  isSelf,
  onClose,
  onSensitive,
  onDelete,
  actions,
}: {
  user: AdminUser | null;
  isSelf: boolean;
  onClose: () => void;
  onSensitive: (p: Sensitive) => void;
  onDelete: (u: AdminUser) => void;
  actions: ReturnType<typeof useUserActions>;
}) {
  const profile = useQuery({
    queryKey: ['profile', user?.username],
    queryFn: () => userService.profile(user!.username),
    enabled: !!user,
  });
  const p = profile.data;

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      {user && (
        <SheetContent side="right" title={`${user.fullName} details`} className="w-[26rem] max-w-[92vw] overflow-y-auto">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <span className="text-sm font-medium text-muted-foreground">Student details</span>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
              <X />
            </Button>
          </div>

          <div className="space-y-5 p-5 animate-fade-in" key={user.id}>
            <div className="flex items-start gap-3">
              <UserAvatar user={user} size="lg" />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl leading-tight">{user.fullName}</h2>
                <p className="truncate text-sm text-muted-foreground">@{user.username}</p>
                <p className="truncate text-sm">{user.email}</p>
                <div className="mt-2">
                  <StatusBadges user={user} />
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">University</dt>
              <dd className="truncate">{user.university}</dd>
              <dt className="text-muted-foreground">Department</dt>
              <dd className="truncate">{user.department}</dd>
              <dt className="text-muted-foreground">Joined</dt>
              <dd>{formatDate(user.createdAt)}</dd>
              <dt className="text-muted-foreground">Last active</dt>
              <dd>{user.lastActiveAt ? timeAgo(user.lastActiveAt) : 'Never'}</dd>
            </dl>

            <div className="grid grid-cols-3 gap-2">
              <Stat label="Projects" value={user._count.projects} />
              <Stat label="Comments" value={user._count.comments} />
              <Stat label="Likes received" value={p?.stats.likesReceived} />
            </div>

            {profile.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-4/5" />
              </div>
            ) : (
              p && (
                <>
                  {p.bio && <p className="text-sm leading-relaxed">{p.bio}</p>}
                  {p.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.skills.map((s) => (
                        <Badge key={s} variant="secondary">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {p.projects.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Projects</h3>
                      <ul className="space-y-1">
                        {p.projects.slice(0, 6).map((proj) => (
                          <li key={proj.id}>
                            <Link
                              to={`/projects/${proj.id}`}
                              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                            >
                              <span className="h-7 w-11 shrink-0 overflow-hidden rounded bg-muted">
                                {proj.coverImageUrl && (
                                  <img src={proj.coverImageUrl} alt="" className="size-full object-cover" loading="lazy" />
                                )}
                              </span>
                              <span className="line-clamp-1 flex-1">{proj.title}</span>
                              {proj.visibility === 'PRIVATE' && <Badge variant="secondary">Private</Badge>}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )
            )}

            {user.deletionRequestedAt && !isSelf && (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <div>
                  <p className="text-sm font-semibold text-destructive">Asked for their account to be deleted</p>
                  <p className="text-xs text-muted-foreground">
                    {timeAgo(user.deletionRequestedAt)} · they are signed out and hidden until you decide
                  </p>
                </div>
                {user.deletionReason && (
                  <blockquote className="border-l-2 border-destructive/40 pl-3 text-sm italic">
                    {user.deletionReason}
                  </blockquote>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => actions.keepAccount.mutate(user.id)}>
                    <Undo2 /> Keep account
                  </Button>
                  <Button variant="destructive" onClick={() => onDelete(user)}>
                    <Trash2 /> Delete
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2 border-t pt-4">
              {isSelf ? (
                <p className="text-sm text-muted-foreground">This is your own account. Another admin can change your role or status.</p>
              ) : user.deletionRequestedAt ? null : (
                <>
                  {!user.emailVerifiedAt && (
                    <Button className="w-full" onClick={() => actions.verify.mutate(user.id)}>
                      <MailCheck /> Verify email
                    </Button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => onSensitive({ kind: 'role', user })}>
                      {user.role === 'ADMIN' ? (
                        <>
                          <ShieldOff /> Remove admin
                        </>
                      ) : (
                        <>
                          <Shield /> Make admin
                        </>
                      )}
                    </Button>
                    {user.status === 'ACTIVE' ? (
                      <Button variant="outline" className="text-destructive" onClick={() => onSensitive({ kind: 'suspend', user })}>
                        <Ban /> Suspend
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => actions.update.mutate({ id: user.id, data: { status: 'ACTIVE' } })}>
                        <Check /> Reactivate
                      </Button>
                    )}
                  </div>
                </>
              )}
              <Button variant="ghost" className="w-full" asChild>
                <Link to={`/u/${user.username}`}>
                  <ExternalLink /> Open public profile
                </Link>
              </Button>
            </div>
          </div>
        </SheetContent>
      )}
    </Dialog>
  );
}

export function AdminUsers() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const { get, set, page } = useUrlState();
  const q = get('q');
  const verified = get('verified');
  const role = get('role');
  const status = get('status');
  const deletion = get('deletion') === 'requested';
  const openId = get('user');

  const query = useQuery({
    queryKey: [...LIST_KEY, { page, q, verified, role, status, deletion }],
    queryFn: () =>
      adminService.users({
        page,
        search: q || undefined,
        verified: verified ? verified === 'true' : undefined,
        role: (role || undefined) as AdminUser['role'] | undefined,
        status: status || undefined,
        deletion: deletion ? 'requested' : undefined,
      }),
    placeholderData: keepPreviousData,
  });
  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const actions = useUserActions();
  const [pending, setPending] = useState<Sensitive | null>(null);
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);

  // The panel follows the live row (so optimistic changes show), and keeps
  // its last copy if the row drops out of a filtered list.
  const [panelUser, setPanelUser] = useState<AdminUser | null>(null);
  useEffect(() => {
    if (!openId) return setPanelUser(null);
    const row = items.find((u) => u.id === openId);
    if (row) setPanelUser(row);
  }, [openId, items]);
  const openPanel = (u: AdminUser) => {
    setPanelUser(u);
    set({ user: u.id });
  };

  // Bulk verification of unverified students on this page.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => setSelected(new Set()), [page, q, verified, role, status]);
  const selectable = items.filter((u) => !u.emailVerifiedAt && u.id !== me?.id);
  const allSelected = selectable.length > 0 && selectable.every((u) => selected.has(u.id));
  const [bulkBusy, setBulkBusy] = useState(false);

  const verifySelected = async () => {
    const ids = [...selected];
    setBulkBusy(true);
    const now = new Date().toISOString();
    queryClient.setQueriesData<{ items: AdminUser[] }>({ queryKey: LIST_KEY }, (old) =>
      old ? { ...old, items: old.items.map((u) => (selected.has(u.id) ? { ...u, emailVerifiedAt: now } : u)) } : old,
    );
    const results = await Promise.allSettled(ids.map((id) => adminService.verifyEmail(id)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) toast.success(`Verified ${ids.length} student${ids.length === 1 ? '' : 's'}`);
    else toast.error(`${ids.length - failed} verified, ${failed} failed. The list has been refreshed.`);
    setSelected(new Set());
    setBulkBusy(false);
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
  };

  const filtersActive = Boolean(q || verified || role || status || deletion);
  const busy = query.isFetching && query.isPlaceholderData;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search by name, username or email" />
        <Select value={verified} onChange={(e) => set({ verified: e.target.value, page: null })} className="w-40" aria-label="Verification">
          <option value="">Any verification</option>
          <option value="false">Unverified</option>
          <option value="true">Verified</option>
        </Select>
        <Select
          value={deletion ? 'deletion' : status}
          onChange={(e) =>
            e.target.value === 'deletion'
              ? set({ deletion: 'requested', status: null, page: null })
              : set({ status: e.target.value, deletion: null, page: null })
          }
          className="w-44"
          aria-label="Status"
        >
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="deletion">Deletion requested</option>
        </Select>
        <Select value={role} onChange={(e) => set({ role: e.target.value, page: null })} className="w-32" aria-label="Role">
          <option value="">Any role</option>
          <option value="STUDENT">Students</option>
          <option value="ADMIN">Admins</option>
        </Select>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={() => set({ q: null, verified: null, role: null, status: null, deletion: null, page: null })}>
            <X /> Clear filters
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {query.data && `${query.data.meta.total} ${query.data.meta.total === 1 ? 'person' : 'people'}`}
        </span>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm animate-fade-in">
          <span className="font-medium">{selected.size} selected</span>
          <Button size="sm" loading={bulkBusy} onClick={verifySelected}>
            <MailCheck /> Verify selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={bulkBusy}>
            Cancel
          </Button>
        </div>
      )}

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.isLoading && items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filtersActive ? 'No one matches these filters' : 'No students yet'}
          description={filtersActive ? 'Try a different search or clear the filters.' : 'New sign-ups will appear here live.'}
        />
      ) : (
        <>
          <Table
            busy={busy}
            head={[
              <Checkbox
                key="all"
                label="Select all unverified on this page"
                checked={allSelected}
                indeterminate={!allSelected && selectable.some((u) => selected.has(u.id))}
                disabled={selectable.length === 0}
                onChange={(on) => setSelected(on ? new Set(selectable.map((u) => u.id)) : new Set())}
              />,
              'Student',
              'University',
              'Activity',
              'Status',
              <span key="a" className="sr-only">
                Actions
              </span>,
            ]}
          >
            {query.isLoading ? (
              <SkeletonRows cols={6} />
            ) : (
              items.map((u) => {
                const canSelect = !u.emailVerifiedAt && u.id !== me?.id;
                return (
                  <tr
                    key={u.id}
                    className="cursor-pointer transition-colors hover:bg-accent/40 data-[open=true]:bg-primary/5"
                    data-open={openId === u.id}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button, a, input, [role="menuitem"]')) return;
                      openPanel(u);
                    }}
                  >
                    <td className="w-10 px-4 py-3">
                      {canSelect && (
                        <Checkbox
                          label={`Select @${u.username}`}
                          checked={selected.has(u.id)}
                          onChange={(on) =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (on) next.add(u.id);
                              else next.delete(u.id);
                              return next;
                            })
                          }
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => openPanel(u)} className="flex items-center gap-3 text-left">
                        <UserAvatar user={u} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {u.fullName}
                            {u.id === me?.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.university}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {plural(u._count.projects, 'project')} · {plural(u._count.comments, 'comment')}
                      <br />
                      Joined {timeAgo(u.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadges user={u} />
                    </td>
                    <td className="px-4 py-3">
                      {u.id !== me?.id && (
                        <RowActions
                          user={u}
                          onOpen={() => openPanel(u)}
                          onSensitive={setPending}
                          onDelete={setToDelete}
                          actions={actions}
                        />
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </Table>
          <Pagination page={page} totalPages={query.data?.meta.totalPages ?? 1} onChange={(p) => set({ page: p })} />
        </>
      )}

      <UserPanel
        user={openId ? panelUser : null}
        isSelf={panelUser?.id === me?.id}
        onClose={() => set({ user: null })}
        onSensitive={setPending}
        onDelete={setToDelete}
        actions={actions}
      />
      <DeleteAccountConfirm
        user={toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={(u) => {
          setToDelete(null);
          if (openId === u.id) set({ user: null }); // the account is gone
          actions.deleteAccount.mutate(u.id);
        }}
      />
      <SensitiveConfirm
        pending={pending}
        onClose={() => setPending(null)}
        onConfirm={(p) => {
          setPending(null);
          if (p.kind === 'suspend') actions.update.mutate({ id: p.user.id, data: { status: 'SUSPENDED' } });
          else actions.update.mutate({ id: p.user.id, data: { role: p.user.role === 'ADMIN' ? 'STUDENT' : 'ADMIN' } });
        }}
      />
    </div>
  );
}
