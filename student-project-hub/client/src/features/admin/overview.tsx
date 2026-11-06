import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Flag, MailWarning } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState, PageLoader } from '@/components/common/states';
import { Card, UserAvatar } from '@/components/ui/misc';
import { adminService } from '@/services/admin.service';
import { compactNumber, timeAgo } from '@/utils/format';
import { DailyBarChart, HorizontalBars } from './charts';

function StatTile({ label, value, sub, to }: { label: string; value: number; sub?: string; to?: string }) {
  const body = (
    <>
      <p className="flex items-center justify-between text-sm text-muted-foreground">
        {label}
        {to && <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{compactNumber(value)}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </>
  );
  return to ? (
    <Link to={to} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full p-4 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md">{body}</Card>
    </Link>
  ) : (
    <Card className="p-4">{body}</Card>
  );
}

/** Shortcuts to the work waiting for an admin; hidden when there is none. */
function NeedsAttention({ unverified, reports }: { unverified: number; reports: number }) {
  if (!unverified && !reports) return null;
  const items = [
    reports > 0 && {
      to: '/admin/reports',
      icon: Flag,
      text: `${reports} report${reports === 1 ? '' : 's'} waiting for review`,
      tone: 'text-destructive bg-destructive/10',
    },
    unverified > 0 && {
      to: '/admin/users?verified=false',
      icon: MailWarning,
      text: `${unverified} student${unverified === 1 ? '' : 's'} with unverified email`,
      tone: 'text-warning bg-warning/15',
    },
  ].filter(Boolean) as { to: string; icon: typeof Flag; text: string; tone: string }[];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map(({ to, icon: Icon, text, tone }) => (
        <Link
          key={to}
          to={to}
          className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm transition-colors hover:border-primary/40"
        >
          <span className={`flex size-8 items-center justify-center rounded-lg ${tone}`}>
            <Icon className="size-4" />
          </span>
          <span className="flex-1 font-medium">{text}</span>
          <span className="text-xs text-muted-foreground transition-colors group-hover:text-foreground">Review</span>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      ))}
    </div>
  );
}

export function AdminOverview() {
  const stats = useQuery({ queryKey: ['admin', 'statistics'], queryFn: adminService.statistics });
  const activity = useQuery({ queryKey: ['admin', 'activity'], queryFn: adminService.activity });

  if (stats.isLoading) return <PageLoader />;
  if (stats.error || !stats.data) return <ErrorState error={stats.error} onRetry={() => stats.refetch()} />;
  const t = stats.data.totals;

  return (
    <div className="space-y-6">
      <NeedsAttention unverified={t.unverifiedUsers} reports={t.pendingReports} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile to="/admin/users" label="Students" value={t.users} sub={`+${t.newUsers} this week · ${t.activeUsers} active`} />
        <StatTile to="/admin/projects" label="Projects" value={t.projects} sub={`${t.publicProjects} public · +${t.newProjects} this week`} />
        <StatTile label="Engagement" value={t.likes + t.comments} sub={`${t.likes} likes · ${t.comments} comments`} />
        <StatTile to="/admin/reports" label="Pending reports" value={t.pendingReports} sub={t.pendingReports ? 'Needs review' : 'All clear'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <DailyBarChart label="New students" data={stats.data.daily.map((d) => ({ date: d.date, value: d.signups }))} />
        </Card>
        <Card className="p-5">
          <DailyBarChart label="New projects" data={stats.data.daily.map((d) => ({ date: d.date, value: d.projects }))} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-medium">Projects by category</h2>
          <HorizontalBars data={stats.data.projectsByCategory} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-medium">Recent activity</h2>
          {activity.isLoading ? (
            <PageLoader />
          ) : (
            <ul className="max-h-96 space-y-3 overflow-y-auto">
              {activity.data?.map((e) => (
                <li key={e.id} className="flex items-start gap-3 text-sm">
                  <UserAvatar user={e.actor} size="xs" className="mt-0.5" />
                  <p className="min-w-0 flex-1">
                    <Link to={`/u/${e.actor.username}`} className="font-medium hover:underline">
                      {e.actor.fullName}
                    </Link>{' '}
                    {e.projectId ? (
                      <Link to={`/projects/${e.projectId}`} className="text-muted-foreground hover:text-foreground">
                        {e.summary}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{e.summary}</span>
                    )}
                  </p>
                  <time className="shrink-0 text-xs text-muted-foreground">{timeAgo(e.createdAt)}</time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
