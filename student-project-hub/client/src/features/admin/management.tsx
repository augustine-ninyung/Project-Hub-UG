import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, ExternalLink, MailCheck, Pencil, Search, Shield, ShieldOff, Star, Trash2, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Pagination } from '@/components/common/pagination';
import { EmptyState, ErrorState, PageLoader } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { Badge, Card, UserAvatar } from '@/components/ui/misc';
import { useAuth } from '@/context/auth-context';
import { useCategories } from '@/features/projects/hooks';
import { getErrorMessage } from '@/services/api';
import { adminService, type AdminReport } from '@/services/admin.service';
import type { Category, ReportStatus } from '@/types/api';
import { formatDate, REPORT_REASON_LABELS, timeAgo } from '@/utils/format';

function useDebounced(value: string, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative max-w-sm flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" aria-label={placeholder} />
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </Card>
  );
}

const mutationToasts = (success: string) => ({
  onSuccess: () => toast.success(success),
  onError: (err: unknown) => toast.error(getErrorMessage(err)),
});

// ─── Users ─────────────────────────────────────────────────────────────

export function AdminUsers() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [verified, setVerified] = useState('');
  const term = useDebounced(search);
  useEffect(() => setPage(1), [term, verified]);

  const query = useQuery({
    queryKey: ['admin', 'users', page, term, verified],
    queryFn: () =>
      adminService.users({ page, search: term || undefined, verified: verified ? verified === 'true' : undefined }),
    placeholderData: keepPreviousData,
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof adminService.updateUser>[1] }) =>
      adminService.updateUser(id, data),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
    ...mutationToasts('User updated'),
  });
  const verify = useMutation({
    mutationFn: (id: string) => adminService.verifyEmail(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
    ...mutationToasts('Email verified. They can now upload and comment.'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, username or email" />
        <Select value={verified} onChange={(e) => setVerified(e.target.value)} className="w-44" aria-label="Verification filter">
          <option value="">All users</option>
          <option value="false">Unverified only</option>
          <option value="true">Verified only</option>
        </Select>
      </div>
      {query.isLoading ? (
        <PageLoader />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <Table head={['Student', 'University', 'Activity', 'Status', 'Actions']}>
            {query.data?.items.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <Link to={`/u/${u.username}`} className="flex items-center gap-3">
                    <UserAvatar user={u} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{u.fullName}</span>
                      <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.university}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {u._count.projects} projects · {u._count.comments} comments
                  <br />
                  Joined {formatDate(u.createdAt)}
                </td>
                <td className="space-x-1 px-4 py-3">
                  {u.role === 'ADMIN' && <Badge>Admin</Badge>}
                  <Badge variant={u.status === 'ACTIVE' ? 'success' : 'destructive'}>
                    {u.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                  </Badge>
                  {!u.emailVerifiedAt && <Badge variant="outline">Unverified</Badge>}
                </td>
                <td className="px-4 py-3">
                  {u.id !== me?.id && (
                    <div className="flex flex-wrap gap-1">
                      {!u.emailVerifiedAt && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={verify.isPending}
                          onClick={() => verify.mutate(u.id)}
                          title={`Mark ${u.email} as verified`}
                        >
                          <MailCheck /> Verify email
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: u.id, data: { status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' } })}
                      >
                        {u.status === 'ACTIVE' ? <><Ban /> Suspend</> : <><Check /> Reactivate</>}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: u.id, data: { role: u.role === 'ADMIN' ? 'STUDENT' : 'ADMIN' } })}
                      >
                        {u.role === 'ADMIN' ? <><ShieldOff /> Revoke admin</> : <><Shield /> Make admin</>}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} totalPages={query.data?.meta.totalPages ?? 1} onChange={setPage} />
        </>
      )}
    </div>
  );
}

// ─── Projects ──────────────────────────────────────────────────────────

export function AdminProjects() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [featured, setFeatured] = useState('');
  const [toDelete, setToDelete] = useState<{ id: string; title: string } | null>(null);
  const term = useDebounced(search);
  useEffect(() => setPage(1), [term, featured]);

  const query = useQuery({
    queryKey: ['admin', 'projects', page, term, featured],
    queryFn: () =>
      adminService.projects({ page, search: term || undefined, featured: featured ? featured === 'true' : undefined }),
    placeholderData: keepPreviousData,
  });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  };
  const feature = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => adminService.setFeatured(id, value),
    onSettled: invalidate,
    ...mutationToasts('Featured projects updated'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminService.deleteProject(id),
    onSettled: () => {
      invalidate();
      setToDelete(null);
    },
    ...mutationToasts('Project removed'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by title or owner" />
        <Select value={featured} onChange={(e) => setFeatured(e.target.value)} className="w-40" aria-label="Featured filter">
          <option value="">All projects</option>
          <option value="true">Featured only</option>
          <option value="false">Not featured</option>
        </Select>
      </div>
      {query.isLoading ? (
        <PageLoader />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <Table head={['Project', 'Owner', 'Engagement', 'Flags', 'Actions']}>
            {query.data?.items.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  <Link to={`/projects/${p.id}`} className="flex items-center gap-3">
                    <span className="h-9 w-14 shrink-0 overflow-hidden rounded bg-muted">
                      {p.coverImageUrl && <img src={p.coverImageUrl} alt="" className="size-full object-cover" loading="lazy" />}
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-1 font-medium">{p.title}</span>
                      <span className="text-xs text-muted-foreground">{p.category.name} · {timeAgo(p.createdAt)}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">@{p.owner.username}</td>
                <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                  {p.likeCount} likes · {p.commentCount} comments
                </td>
                <td className="space-x-1 px-4 py-3">
                  {p.visibility === 'PRIVATE' && <Badge variant="secondary">Private</Badge>}
                  {p.isFeatured && <Badge variant="warning">Featured</Badge>}
                  {p.pendingReports > 0 && <Badge variant="destructive">{p.pendingReports} reports</Badge>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={feature.isPending || (p.visibility === 'PRIVATE' && !p.isFeatured)}
                      onClick={() => feature.mutate({ id: p.id, value: !p.isFeatured })}
                    >
                      <Star className={p.isFeatured ? 'fill-current' : undefined} />
                      {p.isFeatured ? 'Unfeature' : 'Feature'}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setToDelete(p)}>
                      <Trash2 /> Remove
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} totalPages={query.data?.meta.totalPages ?? 1} onChange={setPage} />
        </>
      )}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Remove project?"
        description={`"${toDelete?.title}" and all its comments, likes and images will be permanently deleted.`}
        confirmLabel="Remove project"
        destructive
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}

// ─── Reports ───────────────────────────────────────────────────────────

const REPORT_STATUS_BADGE = {
  PENDING: 'warning',
  RESOLVED: 'success',
  DISMISSED: 'secondary',
} as const;

function ReportCard({ report }: { report: AdminReport }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const review = useMutation({
    mutationFn: (data: { status: 'RESOLVED' | 'DISMISSED'; removeContent?: boolean }) =>
      adminService.reviewReport(report.id, { ...data, resolutionNote: note || undefined }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    ...mutationToasts('Report reviewed'),
  });

  const target = report.project
    ? { label: `Project: ${report.project.title}`, href: `/projects/${report.project.id}`, author: report.project.owner }
    : report.comment
      ? { label: `Comment: “${report.comment.deletedAt ? '(deleted)' : report.comment.content}”`, href: `/projects/${report.comment.projectId}#comments`, author: report.comment.author }
      : null;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={REPORT_STATUS_BADGE[report.status]}>{report.status.toLowerCase()}</Badge>
        <Badge variant="outline">{REPORT_REASON_LABELS[report.reason]}</Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          Reported by @{report.reporter.username} · {timeAgo(report.createdAt)}
        </span>
      </div>
      {target ? (
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          <Link to={target.href} className="inline-flex items-start gap-1.5 font-medium hover:underline">
            <span className="line-clamp-2">{target.label}</span>
            <ExternalLink className="mt-0.5 size-3.5 shrink-0" />
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">By @{target.author.username}</p>
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground">The reported content has already been removed.</p>
      )}
      {report.details && <p className="text-sm">{report.details}</p>}

      {report.status === 'PENDING' ? (
        <div className="space-y-2">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolution note (optional)" aria-label="Resolution note" />
          <div className="flex flex-wrap gap-2">
            {target && (
              <Button variant="destructive" size="sm" disabled={review.isPending} onClick={() => review.mutate({ status: 'RESOLVED', removeContent: true })}>
                <Trash2 /> Remove content
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={review.isPending} onClick={() => review.mutate({ status: 'RESOLVED' })}>
              <Check /> Resolve, keep content
            </Button>
            <Button variant="ghost" size="sm" disabled={review.isPending} onClick={() => review.mutate({ status: 'DISMISSED' })}>
              <X /> Dismiss
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Reviewed by @{report.reviewedBy?.username ?? 'unknown'} {report.reviewedAt && timeAgo(report.reviewedAt)}
          {report.resolutionNote && ` — ${report.resolutionNote}`}
        </p>
      )}
    </Card>
  );
}

export function AdminReports() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ReportStatus | ''>('PENDING');
  const query = useQuery({
    queryKey: ['admin', 'reports', page, status],
    queryFn: () => adminService.reports({ page, status: status || undefined }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <Select
        value={status}
        onChange={(e) => {
          setStatus(e.target.value as ReportStatus | '');
          setPage(1);
        }}
        className="w-44"
        aria-label="Report status"
      >
        <option value="PENDING">Pending</option>
        <option value="RESOLVED">Resolved</option>
        <option value="DISMISSED">Dismissed</option>
        <option value="">All reports</option>
      </Select>
      {query.isLoading ? (
        <PageLoader />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data?.items.length ? (
        <EmptyState icon={Check} title="No reports here" description="Nothing needs your attention." />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {query.data.items.map((r) => (
              <ReportCard key={r.id} report={r} />
            ))}
          </div>
          <Pagination page={page} totalPages={query.data.meta.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

// ─── Categories ────────────────────────────────────────────────────────

function CategoryDialog({ category, open, onOpenChange }: { category: Category | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  useEffect(() => {
    setName(category?.name ?? '');
    setDescription(category?.description ?? '');
  }, [category, open]);

  const save = useMutation({
    mutationFn: () => {
      const data = { name: name.trim(), description: description.trim() || null };
      return category ? adminService.updateCategory(category.id, data) : adminService.createCategory(data);
    },
    onSuccess: () => {
      toast.success(category ? 'Category updated' : 'Category created');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title={category ? 'Edit category' : 'New category'} />
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Name" htmlFor="cat-name" required error={save.isError ? getErrorMessage(save.error) : undefined}>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
          </Field>
          <Field label="Description" htmlFor="cat-desc">
            <Textarea id="cat-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={name.trim().length < 2} loading={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminCategories() {
  const queryClient = useQueryClient();
  const categories = useCategories();
  const [editing, setEditing] = useState<Category | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => adminService.deleteCategory(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setToDelete(null);
    },
    ...mutationToasts('Category deleted'),
  });

  return (
    <div className="space-y-4">
      <Button
        onClick={() => {
          setEditing(null);
          setDialogOpen(true);
        }}
      >
        New category
      </Button>
      {categories.isLoading ? (
        <PageLoader />
      ) : (
        <Table head={['Name', 'Description', 'Public projects', 'Actions']}>
          {categories.data?.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-3 font-medium">{c.name}</td>
              <td className="max-w-xs px-4 py-3 text-muted-foreground">{c.description}</td>
              <td className="px-4 py-3 tabular-nums">{c.projectCount ?? 0}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(c);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setToDelete(c)}>
                    <Trash2 /> Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <CategoryDialog category={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete "${toDelete?.name}"?`}
        description="Categories that are still used by projects cannot be deleted."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}
