import { Plus, Sparkles, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Section } from '@/components/common/section';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/misc';
import { useAuth } from '@/context/auth-context';
import { useInvitations, useRespondToInvitation } from '@/features/notifications/hooks';
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

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function Welcome() {
  const { user } = useAuth();

  // Signed-out visitors get the landing page at "/" instead of this dashboard.
  if (!user) return null;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{greeting()},</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {user.fullName.split(' ')[0]} 👋
        </h1>
        <p className="mt-1 text-muted-foreground">
          See what the community has been building this week.
        </p>
      </div>
      <Button asChild size="lg">
        <Link to="/projects/new">
          <Plus /> Share a project
        </Link>
      </Button>
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
  const featured = useFeaturedProjects(3);
  const recent = useProjects({ sort: 'newest', limit: 6 });
  const trending = useTrendingProjects(5);
  const recommended = useRecommendedProjects(3);
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
              skeletonCount={3}
            />
          </Section>
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <Sparkles className="size-4 text-primary" /> Trending this week
            </h2>
            <TrendingList projects={trending.data} isLoading={trending.isLoading} />
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Browse categories</h2>
            <div className="flex flex-wrap gap-2">
              {categories.data?.map((c) => (
                <Link
                  key={c.id}
                  to={`/explore?category=${c.slug}`}
                  className="rounded-full border px-3 py-1 text-sm transition-colors hover:border-primary hover:text-primary"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-semibold">Recently active students</h2>
            <ActiveStudents />
          </Card>
        </aside>
      </div>
    </div>
  );
}
