import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ErrorState, PageLoader } from '@/components/common/states';
import { Card, UserAvatar } from '@/components/ui/misc';
import { adminService } from '@/services/admin.service';
import { compactNumber, timeAgo } from '@/utils/format';
import { DailyBarChart, HorizontalBars } from './charts';

function StatTile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{compactNumber(value)}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </Card>
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Students" value={t.users} sub={`+${t.newUsers} this week · ${t.activeUsers} active`} />
        <StatTile label="Projects" value={t.projects} sub={`${t.publicProjects} public · +${t.newProjects} this week`} />
        <StatTile label="Engagement" value={t.likes + t.comments} sub={`${t.likes} likes · ${t.comments} comments`} />
        <StatTile label="Pending reports" value={t.pendingReports} sub={t.pendingReports ? 'Needs review' : 'All clear'} />
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
