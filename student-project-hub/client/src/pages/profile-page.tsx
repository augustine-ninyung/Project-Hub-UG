import { useQuery } from '@tanstack/react-query';
import { Building2, CalendarDays, Globe, GraduationCap, Pencil, Plus, UserX } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GithubIcon, LinkedinIcon } from '@/components/common/brand-icons';
import { EmptyState, ErrorState, PageLoader } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Badge, Card, UserAvatar } from '@/components/ui/misc';
import { useAuth } from '@/context/auth-context';
import { ProjectGrid } from '@/features/projects/project-grid';
import { getStatus } from '@/services/api';
import { userService } from '@/services/user.service';
import { cn } from '@/utils/cn';
import { compactNumber, formatDate } from '@/utils/format';

type Tab = 'projects' | 'contributions';

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: me } = useAuth();
  const [tab, setTab] = useState<Tab>('projects');
  const { data: profile, isLoading, error, refetch } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => userService.profile(username!),
    enabled: Boolean(username),
  });

  if (isLoading) return <PageLoader />;
  if (getStatus(error) === 404) {
    return <EmptyState icon={UserX} title="Student not found" description={`There is no user called @${username}.`} />;
  }
  if (error || !profile) return <ErrorState error={error} onRetry={() => refetch()} />;

  const isMe = me?.id === profile.id;
  const links = [
    profile.githubUrl && { href: profile.githubUrl, label: 'GitHub', icon: GithubIcon },
    profile.linkedinUrl && { href: profile.linkedinUrl, label: 'LinkedIn', icon: LinkedinIcon },
    profile.portfolioUrl && { href: profile.portfolioUrl, label: 'Portfolio', icon: Globe },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Globe }[];

  const stats = [
    { label: 'Projects', value: profile.stats.projects },
    { label: 'Contributions', value: profile.stats.contributions },
    { label: 'Likes received', value: profile.stats.likesReceived },
  ];

  const list = tab === 'projects' ? profile.projects : profile.contributions;

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-5">
        <div className="flex items-center gap-4 lg:flex-col lg:items-start">
          <UserAvatar user={profile} size="xl" className="size-20 lg:size-40 lg:text-4xl" />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">{profile.fullName}</h1>
            <p className="text-muted-foreground">@{profile.username}</p>
            {profile.role === 'ADMIN' && <Badge className="mt-1">Admin</Badge>}
          </div>
        </div>

        {profile.bio && <p className="whitespace-pre-line text-sm leading-relaxed">{profile.bio}</p>}

        {isMe && (
          <Button asChild variant="outline" className="w-full">
            <Link to="/settings">
              <Pencil /> Edit profile
            </Link>
          </Button>
        )}

        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <Building2 className="size-4 shrink-0" /> {profile.university}
          </li>
          <li className="flex items-center gap-2">
            <GraduationCap className="size-4 shrink-0" /> {profile.department}
          </li>
          <li className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0" /> Joined {formatDate(profile.createdAt)}
          </li>
          {links.map((l) => (
            <li key={l.label}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-primary"
              >
                <l.icon className="size-4 shrink-0" />
                <span className="truncate">{l.label}</span>
              </a>
            </li>
          ))}
        </ul>

        <Card className="grid grid-cols-3 divide-x p-0">
          {stats.map((s) => (
            <div key={s.label} className="px-2 py-3 text-center">
              <p className="text-lg font-semibold tabular-nums">{compactNumber(s.value)}</p>
              <p className="text-[11px] leading-tight text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </Card>

        {profile.skills.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold">Skills & interests</h2>
            <ul className="flex flex-wrap gap-1.5">
              {profile.skills.map((s) => (
                <li key={s} className="rounded-full border px-2.5 py-0.5 text-xs">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <section className="min-w-0 space-y-5">
        <div className="flex items-center justify-between gap-2 border-b" role="tablist">
          <div className="flex">
            {(['projects', 'contributions'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors',
                  tab === t
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t}{' '}
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                  {t === 'projects' ? profile.projects.length : profile.contributions.length}
                </span>
              </button>
            ))}
          </div>
          {isMe && tab === 'projects' && (
            <Button asChild size="sm" variant="ghost" className="mb-1">
              <Link to="/projects/new">
                <Plus /> New
              </Link>
            </Button>
          )}
        </div>

        <ProjectGrid
          projects={list}
          isLoading={false}
          empty={
            tab === 'projects'
              ? {
                  title: isMe ? "You haven't shared any projects yet" : 'No projects yet',
                  description: isMe ? 'Share something you built with the community.' : undefined,
                  action: isMe ? (
                    <Button asChild>
                      <Link to="/projects/new">
                        <Plus /> Share a project
                      </Link>
                    </Button>
                  ) : undefined,
                }
              : { title: 'No contributions yet' }
          }
        />
      </section>
    </div>
  );
}
