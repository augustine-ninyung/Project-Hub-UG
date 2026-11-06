import { useQuery } from '@tanstack/react-query';
import { Bell, FolderGit2, Heart, Moon, Plus, Sparkles, Sun, Sunrise, UserPlus, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Section } from '@/components/common/section';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/misc';
import { useAuth } from '@/context/auth-context';
import { useInvitations, useRespondToInvitation, useUnreadCount } from '@/features/notifications/hooks';
import {
  useCategories,
  useFeaturedProjects,
  useProjects,
  useRecommendedProjects,
  useTrendingProjects,
} from '@/features/projects/hooks';
import { ProjectGrid } from '@/features/projects/project-grid';
import { TrendingList } from '@/features/projects/trending-list';
import { ActiveStudents } from '@/features/users/active-students';
import { userService } from '@/services/user.service';
import { cn } from '@/utils/cn';
import { compactNumber } from '@/utils/format';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good morning', Icon: Sunrise };
  if (h < 18) return { text: 'Good afternoon', Icon: Sun };
  return { text: 'Good evening', Icon: Moon };
}

function QuickStat({
  to,
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  value: number | undefined;
  highlight?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group flex min-w-0 items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5 shadow-xs transition-[border-color,box-shadow,transform] duration-200 ease-smooth hover:-translate-y-px hover:border-foreground/15 hover:shadow-sm',
        highlight && 'border-primary/30 bg-primary/[0.04]',
      )}
    >
      <span
        className={cn(
          'hidden size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground transition-colors group-hover:text-foreground sm:flex',
          highlight && 'bg-primary/10 text-primary group-hover:text-primary',
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-lg font-semibold tabular-nums">
          {value === undefined ? <span className="text-muted-foreground">–</span> : compactNumber(value)}
        </span>
        <span className="block text-xs text-muted-foreground sm:truncate">{label}</span>
      </span>
    </Link>
  );
}

function Welcome() {
  const { user } = useAuth();
  const unread = useUnreadCount();
  const profile = useQuery({
    queryKey: ['profile', user?.username],
    queryFn: () => userService.profile(user!.username),
    enabled: !!user,
  });

  // Signed-out visitors get the landing page at "/" instead of this dashboard.
  if (!user) return null;
  const { text, Icon } = greeting();
  const stats = profile.data?.stats;

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Icon className="size-4 text-brand" aria-hidden />
          {text},
        </p>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">{user.fullName.split(' ')[0]}</h1>
        <p className="mt-1 text-muted-foreground">See what the community has been building this week.</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-auto">
        <QuickStat to={`/u/${user.username}`} icon={FolderGit2} label="Your projects" value={stats?.projects} />
        <QuickStat to={`/u/${user.username}`} icon={Heart} label="Likes received" value={stats?.likesReceived} />
        <QuickStat to="/notifications" icon={Bell} label="Unread" value={unread} highlight={unread > 0} />
      </div>
    </div>
  );
}

function PendingInvitations() {
  const { data } = useInvitations();
  const respond = useRespondToInvitation();
  if (!data?.length) return null;

  return (
    <Card className="border-warning/40 bg-warning/5 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <UserPlus className="size-4 text-warning" /> Collaboration invitations
      </h2>
      <ul className="space-y-2">
        {data.map((inv) => (
          <li key={inv.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="flex-1 text-sm">
              <span className="font-medium">{inv.invitedBy?.fullName ?? 'Someone'}</span> invited you
              to contribute to{' '}
              <Link to={`/projects/${inv.project.id}`} className="font-medium text-primary hover:underline">
                {inv.project.title}
              </Link>
              {inv.role && <span className="text-muted-foreground"> as {inv.role}</span>}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ projectId: inv.project.id, status: 'ACCEPTED' })}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ projectId: inv.project.id, status: 'DECLINED' })}
              >
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const featured = useFeaturedProjects(6);
  const recent = useProjects({ sort: 'newest', limit: 6 });
  const trending = useTrendingProjects(5);
  const recommended = useRecommendedProjects(4);
  const categories = useCategories();

  return (
    <div className="space-y-8">
      <Welcome />
      <PendingInvitations />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-10">
          {(featured.isLoading || !!featured.data?.length) && (
            <Section title="Featured" description="Hand-picked by the community team">
              <ProjectGrid
                projects={featured.data}
                isLoading={featured.isLoading}
                error={featured.error}
                skeletonCount={3}
                layout="row"
              />
            </Section>
          )}

          <Section title="Recent projects" href="/explore?sort=newest">
            <ProjectGrid
              projects={recent.data?.items}
              isLoading={recent.isLoading}
              error={recent.error}
              onRetry={() => recent.refetch()}
              empty={{
                title: 'No projects yet',
                description: 'Be the first to share something you built.',
                action: (
                  <Button asChild>
                    <Link to="/projects/new">
                      <Plus /> Share a project
                    </Link>
                  </Button>
                ),
              }}
            />
          </Section>

          <Section
            title={isAuthenticated ? 'Recommended for you' : 'Popular right now'}
            description={
              isAuthenticated ? 'Based on projects you have liked and built' : undefined
            }
          >
            <ProjectGrid
              projects={recommended.data}
              isLoading={recommended.isLoading}
              error={recommended.error}
              skeletonCount={4}
            />
          </Section>
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" /> Trending this week
            </h2>
            <TrendingList projects={trending.data} isLoading={trending.isLoading} />
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Browse categories</h2>
            <div className="flex flex-wrap gap-2">
              {categories.data?.map((c) => (
                <Link
                  key={c.id}
                  to={`/explore?category=${c.slug}`}
                  className="rounded-full border px-3 py-1 text-sm transition-colors duration-150 hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold">Recently active students</h2>
            <ActiveStudents />
          </Card>
        </aside>
      </div>
    </div>
  );
}
