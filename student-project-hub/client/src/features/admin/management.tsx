import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, FolderOpen, Pencil, Star, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Pagination } from '@/components/common/pagination';
import { EmptyState, ErrorState, PageLoader } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { Badge, Card } from '@/components/ui/misc';
import { useCategories } from '@/features/projects/hooks';
import { getErrorMessage } from '@/services/api';
import { adminService, type AdminProject, type AdminReport } from '@/services/admin.service';
import type { Category, ReportStatus } from '@/types/api';
import { REPORT_REASON_LABELS, timeAgo } from '@/utils/format';
import { plural, SearchInput, SkeletonRows, Table, useOptimisticRows, useUrlState } from './shared';

export { AdminUsers } from './admin-users';

const mutationToasts = (success: string) => ({
  onSuccess: () => toast.success(success),
  onError: (err: unknown) => toast.error(getErrorMessage(err)),
});

// ─── Projects ──────────────────────────────────────────────────────────

const PROJECTS_KEY = ['admin', 'projects'] as const;

export function AdminProjects() {
  const queryClient = useQueryClient();
  const { get, set, page } = useUrlState();
  const q = get('q');
  const featured = get('featured');
  const [toDelete, setToDelete] = useState<AdminProject | null>(null);

  const query = useQuery({
    queryKey: [...PROJECTS_KEY, { page, q, featured }],
    queryFn: () =>
      adminService.projects({ page, search: q || undefined, featured: featured ? featured === 'true' : undefined }),
    placeholderData: keepPreviousData,
  });
  const items = query.data?.items ?? [];

  const feature = useOptimisticRows<AdminProject, { id: string; value: boolean }>({
    listKey: PROJECTS_KEY,
    mutationFn: ({ id, value }) => adminService.setFeatured(id, value),
    apply: (p, { id, value }) => (p.id === id ? { ...p, isFeatured: value } : p),
    success: ({ value }) => (value ? 'Featured on the home page' : 'Removed from featured'),
  });
  const remove = useOptimisticRows<AdminProject, string>({
    listKey: PROJECTS_KEY,
    mutationFn: (id) => adminService.deleteProject(id),
    apply: (p, id) => (p.id === id ? null : p),
    success: 'Project removed',
  });

  const filtersActive = Boolean(q || featured);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search by title or owner" />
        <Select value={featured} onChange={(e) => set({ featured: e.target.value, page: null })} className="w-40" aria-label="Featured filter">
          <option value="">All projects</option>
          <option value="true">Featured only</option>
          <option value="false">Not featured</option>
        </Select>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={() => set({ q: null, featured: null, page: null })}>
            <X /> Clear filters
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {query.data && `${query.data.meta.total} project${query.data.meta.total === 1 ? '' : 's'}`}
        </span>
      </div>
      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.isLoading && items.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={filtersActive ? 'No projects match these filters' : 'No projects yet'}
          description={filtersActive ? 'Try a different search or clear the filters.' : 'New projects will appear here live.'}
        />
      ) : (
        <>
          <Table
            busy={query.isFetching && query.isPlaceholderData}
            head={['Project', 'Owner', 'Engagement', 'Flags', <span key="a" className="sr-only">Actions</span>]}
          >
            {query.isLoading ? (
              <SkeletonRows cols={5} />
            ) : (
              items.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <Link to={`/projects/${p.id}`} className="group flex items-center gap-3">
                      <span className="h-9 w-14 shrink-0 overflow-hidden rounded bg-muted">
                        {p.coverImageUrl && (
                          <img
                            src={p.coverImageUrl}
                            alt=""
                            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-1 font-medium group-hover:underline">{p.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.category.name} · {timeAgo(p.createdAt)}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/users?q=${encodeURIComponent(p.owner.username)}`}
                      className="text-muted-foreground hover:text-foreground hover:underline"
                      title="Find this student in the admin list"
                    >
                      @{p.owner.username}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                    {plural(p.likeCount, 'like')} · {plural(p.commentCount, 'comment')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1">
                      {p.visibility === 'PRIVATE' && <Badge variant="secondary">Private</Badge>}
                      {p.isFeatured && <Badge variant="warning">Featured</Badge>}
                      {p.pendingReports > 0 && (
                        <Link to="/admin/reports">
                          <Badge variant="destructive">
                            {p.pendingReports} report{p.pendingReports === 1 ? '' : 's'}
                          </Badge>
                        </Link>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={p.visibility === 'PRIVATE' && !p.isFeatured}
                        title={p.visibility === 'PRIVATE' && !p.isFeatured ? 'Private projects cannot be featured' : undefined}
                        onClick={() => feature.mutate({ id: p.id, value: !p.isFeatured })}
                      >
                        <Star className={p.isFeatured ? 'fill-warning text-warning' : undefined} />
                        {p.isFeatured ? 'Unfeature' : 'Feature'}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setToDelete(p)}>
                        <Trash2 /> Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </Table>
          <Pagination page={page} totalPages={query.data?.meta.totalPages ?? 1} onChange={(n) => set({ page: n })} />
        </>
      )}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Remove project?"
        description={`"${toDelete?.title}" and all its comments, likes and images will be permanently deleted.`}
        confirmLabel="Remove project"
        destructive
        onConfirm={() => {
          if (!toDelete) return;
          remove.mutate(toDelete.id, {
            onSettled: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
          });
          setToDelete(null);
        }}
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
  const { get, set, page } = useUrlState();
  // Pending by default; 'all' in the URL shows every status.
  const rawStatus = get('status', 'PENDING');
  const status = (rawStatus === 'all' ? '' : rawStatus) as ReportStatus | '';
  const setPage = (n: number) => set({ page: n });
  const query = useQuery({
    queryKey: ['admin', 'reports', page, status],
    queryFn: () => adminService.reports({ page, status: status || undefined }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <Select
        value={status}
        onChange={(e) =>
          set({ status: e.target.value === 'PENDING' ? null : e.target.value || 'all', page: null })
        }
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
