import {
  ArrowRight,
  Bell,
  Heart,
  MessagesSquare,
  Moon,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Upload,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { Skeleton, UserAvatar } from '@/components/ui/misc';
import { useTheme } from '@/context/theme-context';
import {
  useCategories,
  useCommunityStats,
  useFeaturedProjects,
  useProjects,
} from '@/features/projects/hooks';
import { LiveFeed } from '@/features/projects/live-feed';
import { CoverFallback } from '@/features/projects/project-card';
import { ProjectGrid } from '@/features/projects/project-grid';
import type { ProjectCard } from '@/types/api';
import { cn } from '@/utils/cn';
import { compactNumber } from '@/utils/format';

/** Public marketing page shown at "/" to signed-out visitors. All figures come from the API. */
export default function LandingPage() {
  useEffect(() => {
    document.title = 'ProjectHub — Student project showcase';
  }, []);

  return (
    <div className="min-h-dvh overflow-x-clip">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <LiveFeed />
      <LandingHeader />
      <main id="main">
        <Hero />
        <Categories />
        <Features />
        <HowItWorks />
        <Showcase />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}

const container = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8';

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">
      <span aria-hidden className="h-px w-6 bg-brand" />
      {children}
    </p>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn('max-w-2xl space-y-3', className)}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="font-display text-3xl font-medium tracking-tight text-balance sm:text-[2.6rem] sm:leading-[1.1]">
        {title}
      </h2>
      {description && <p className="text-lg text-muted-foreground text-pretty">{description}</p>}
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}

function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/65">
      <div className={cn(container, 'flex h-16 items-center gap-6')}>
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 text-sm md:flex">
          {[
            { href: '#features', label: 'Features' },
            { href: '#how-it-works', label: 'How it works' },
            { href: '#showcase', label: 'Showcase' },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/explore"
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            Explore
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/register">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ----------------------------------------------------------------- Hero */

function Hero() {
  return (
    <section className="relative isolate">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
      />
      <div
        aria-hidden
        className="absolute left-1/2 top-0 -z-10 h-[480px] w-[min(1100px,100%)] -translate-x-1/2 rounded-full bg-brand/15 blur-3xl dark:bg-brand/10"
      />

      <div
        className={cn(
          container,
          'grid items-center gap-14 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28 lg:pt-24',
        )}
      >
        <div className="animate-fade-in space-y-7">
          <Link
            to="/explore?sort=newest"
            className="group inline-flex items-center gap-2 rounded-full border bg-card/70 py-1 pl-1 pr-3 text-sm shadow-xs backdrop-blur transition-colors hover:border-primary/50"
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <Sparkles className="size-3" aria-hidden /> New
            </span>
            <span className="text-muted-foreground group-hover:text-foreground">
              See what students shipped this week
            </span>
            <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>

          <h1 className="text-[2.75rem] font-medium leading-[1.04] tracking-[-0.02em] text-balance sm:text-6xl lg:text-[4.25rem]">
            Where student projects <em className="font-normal italic text-primary">get seen</em>.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground text-pretty">
            ProjectHub is the community where students showcase websites, apps, AI models,
            hardware and designs — get real feedback from peers and find collaborators for
            what comes next.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 rounded-lg px-6 text-[15px] shadow-sm shadow-primary/20">
              <Link to="/register">
                Share your project <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 rounded-lg px-6 text-[15px]">
              <Link to="/explore">
                <Search /> Explore projects
              </Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Free for students.{' '}
            <Link to="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              Already a member? Sign in
            </Link>
          </p>

          <StatsRow />
        </div>

        <HeroCollage />
      </div>
    </section>
  );
}

function StatsRow() {
  const { data, isLoading, isError } = useCommunityStats();
  if (isError) return null;

  const stats = [
    { label: 'Projects shared', value: data?.projects },
    { label: 'Students', value: data?.students },
    { label: 'Universities', value: data?.universities },
    { label: 'Likes given', value: data?.likes },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-6 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="space-y-1">
          <dt className="text-xs text-muted-foreground">{s.label}</dt>
          <dd className="font-display text-3xl font-medium tabular-nums tracking-tight">
            {isLoading || s.value === undefined ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              compactNumber(s.value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Real featured projects arranged as an overlapping stack; falls back to the most liked. */
function HeroCollage() {
  const featured = useFeaturedProjects(3);
  const popular = useProjects({ sort: 'most_liked', limit: 6 });
  const isLoading = featured.isLoading || popular.isLoading;

  const picks: ProjectCard[] = [];
  for (const p of [...(featured.data ?? []), ...(popular.data?.items ?? [])]) {
    if (picks.length < 3 && !picks.some((x) => x.id === p.id)) picks.push(p);
  }

  const slots = [
    'left-0 top-6 w-[78%] rotate-[-2deg] z-20',
    'right-0 top-0 w-[58%] rotate-[3deg] z-10',
    'right-[6%] bottom-0 w-[60%] rotate-[-1deg] z-30',
  ];

  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-[560px] animate-fade-in [animation-delay:120ms] [animation-fill-mode:both]">
      {isLoading || picks.length === 0
        ? slots.map((slot) => (
            <div
              key={slot}
              className={cn('absolute overflow-hidden rounded-2xl border bg-card p-2 shadow-lg', slot)}
            >
              {isLoading ? (
                <Skeleton className="aspect-[16/10] rounded-xl" />
              ) : (
                <div className="aspect-[16/10] overflow-hidden rounded-xl">
                  <CoverFallback title="Your project" />
                </div>
              )}
            </div>
          ))
        : picks.map((p, i) => <CollageCard key={p.id} project={p} className={slots[i]!} />)}
    </div>
  );
}

function CollageCard({ project, className }: { project: ProjectCard; className: string }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className={cn(
        'group absolute rounded-2xl border bg-card p-2 shadow-xl shadow-black/5 transition-transform duration-300 hover:z-40 hover:-translate-y-1 hover:rotate-0 focus-visible:z-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:shadow-black/40',
        className,
      )}
    >
      <div className="aspect-[16/10] overflow-hidden rounded-xl bg-muted">
        {project.coverImageUrl ? (
          <img src={project.coverImageUrl} alt="" className="size-full object-cover" />
        ) : (
          <CoverFallback title={project.title} />
        )}
      </div>
      <div className="flex items-center gap-2 px-1.5 pb-0.5 pt-2.5">
        <UserAvatar user={project.owner} size="xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{project.title}</p>
          <p className="truncate text-xs text-muted-foreground">{project.owner.university}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground">
          <Heart className="size-3.5" aria-hidden />
          <span className="sr-only">Likes:</span>
          {compactNumber(project.likeCount)}
        </span>
      </div>
    </Link>
  );
}

/* ----------------------------------------------------------- Categories */

function Categories() {
  const { data } = useCategories();
  const categories = data?.filter((c) => (c.projectCount ?? 0) > 0) ?? [];
  if (!categories.length) return null;

  return (
    <section aria-labelledby="categories-title" className="border-y bg-muted/30">
      <div className={cn(container, 'flex flex-col gap-4 py-8 md:flex-row md:items-center md:gap-8')}>
        <h2 id="categories-title" className="shrink-0 text-sm font-medium text-muted-foreground">
          Every kind of project
        </h2>
        <ul className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                to={`/explore?category=${c.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary hover:text-primary"
              >
                {c.name}
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {c.projectCount}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Features */

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: Upload,
    title: 'A home for your work',
    description:
      'Publish projects with a cover, screenshots, tech stack, GitHub and live demo links — public or private.',
  },
  {
    icon: Search,
    title: 'Discover what peers build',
    description:
      'Search by title, technology or category, and sort by what is newest or most loved this week.',
  },
  {
    icon: MessagesSquare,
    title: 'Feedback that goes deeper',
    description:
      'Likes and threaded comments turn a project page into a real conversation with other builders.',
  },
  {
    icon: Users,
    title: 'Build together',
    description:
      'Invite contributors by username and credit everyone who helped — collaborations show on every profile.',
  },
  {
    icon: UserRound,
    title: 'A portfolio that grows',
    description:
      'Your profile collects your projects, skills and links in one place to share with recruiters.',
  },
  {
    icon: ShieldCheck,
    title: 'A safe community',
    description:
      'Verified accounts, reporting tools and active moderation keep the space respectful.',
  },
];

function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-20 sm:py-28">
      <div className={container}>
        <SectionHeading
          eyebrow="Features"
          title="Everything a student builder needs"
          description="From the first commit to the final demo, give your work the audience it deserves."
        />
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="group space-y-3 bg-card p-6 transition-colors hover:bg-muted/40 sm:p-8">
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand/12 text-primary ring-1 ring-brand/20 transition-colors group-hover:bg-brand/20">
                <f.icon className="size-5" aria-hidden />
              </span>
              <h3 className="font-display text-lg font-medium tracking-tight">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- How it works */

const STEPS = [
  {
    title: 'Create your profile',
    description: 'Sign up with your university details, verify your email and add your skills.',
  },
  {
    title: 'Share a project',
    description: 'Upload images, list your stack and link the repo or live demo in a few minutes.',
  },
  {
    title: 'Grow with the community',
    description: 'Collect feedback, get notified when people engage and team up on new ideas.',
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-y bg-muted/30 py-20 sm:py-28">
      <div className={cn(container, 'grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16')}>
        <SectionHeading
          eyebrow="How it works"
          title="From idea to audience in three steps"
          description="No portfolio site to maintain, no setup. Just show your work."
        />
        <ol className="relative space-y-8">
          <span aria-hidden className="absolute bottom-6 left-5 top-6 w-px bg-border" />
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative flex gap-5">
              <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full border bg-background font-display text-lg font-medium text-primary shadow-xs">
                {i + 1}
              </span>
              <div className="space-y-1 pt-1.5">
                <h3 className="font-display text-lg font-medium tracking-tight">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            </li>
          ))}
          <li className="relative flex gap-5">
            <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Bell className="size-4" aria-hidden />
            </span>
            <p className="pt-2 text-sm text-muted-foreground">
              You'll get a notification the moment someone likes, comments on or invites you to a project.
            </p>
          </li>
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Showcase */

function Showcase() {
  const popular = useProjects({ sort: 'most_liked', limit: 6 });

  return (
    <section id="showcase" className="scroll-mt-20 py-20 sm:py-28">
      <div className={container}>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow="Showcase"
            title="Loved by the community"
            description="A few of the most-liked projects on ProjectHub right now."
          />
          <Button asChild variant="outline" className="self-start sm:self-auto">
            <Link to="/explore?sort=most_liked">
              Browse all projects <ArrowRight />
            </Link>
          </Button>
        </div>
        <ProjectGrid
          className="mt-10"
          projects={popular.data?.items}
          isLoading={popular.isLoading}
          error={popular.error}
          onRetry={() => popular.refetch()}
          empty={{
            title: 'No projects yet',
            description: 'Be the first to share something you built.',
            action: (
              <Button asChild>
                <Link to="/register">Share your project</Link>
              </Button>
            ),
          }}
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Final CTA */

function FinalCta() {
  return (
    <section className="pb-20 sm:pb-28">
      <div className={container}>
        <div className="relative isolate overflow-hidden rounded-3xl bg-ink px-6 py-14 text-center text-[#FAF9F5] ring-1 ring-white/5 sm:px-12 sm:py-20">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-[0.12] [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
          />
          <div
            aria-hidden
            className="absolute -bottom-40 left-1/2 -z-10 h-80 w-[min(720px,100%)] -translate-x-1/2 rounded-full bg-brand/35 blur-3xl"
          />
          <h2 className="font-display mx-auto max-w-2xl text-3xl font-medium tracking-tight text-balance sm:text-[2.75rem] sm:leading-[1.1]">
            Your next project deserves <em className="font-normal italic text-brand">an audience</em>.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-[#FAF9F5]/75 text-pretty">
            Join students sharing their work, trading feedback and finding teammates.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-11 rounded-lg bg-brand px-6 text-[15px] text-[#141413] hover:bg-brand/90"
            >
              <Link to="/register">
                Create your free account <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-11 rounded-lg px-6 text-[15px] text-[#FAF9F5] hover:bg-white/10 hover:text-[#FAF9F5]"
            >
              <Link to="/explore">Explore first</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Footer */

function LandingFooter() {
  const columns = [
    {
      title: 'Platform',
      links: [
        { to: '/explore', label: 'Explore projects' },
        { to: '/explore?sort=newest', label: 'Newest' },
        { to: '/explore?sort=most_liked', label: 'Most liked' },
      ],
    },
    {
      title: 'Account',
      links: [
        { to: '/register', label: 'Create account' },
        { to: '/login', label: 'Sign in' },
        { to: '/forgot-password', label: 'Reset password' },
      ],
    },
  ];

  return (
    <footer className="border-t">
      <div className={cn(container, 'grid gap-10 py-12 sm:grid-cols-[1.5fr_1fr_1fr]')}>
        <div className="max-w-xs space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground">
            The showcase and community for student-built projects.
          </p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title} className="space-y-3">
            <h2 className="text-sm font-semibold">{col.title}</h2>
            <ul className="space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-muted-foreground transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className={cn(container, 'border-t py-6 text-xs text-muted-foreground')}>
        © {new Date().getFullYear()} ProjectHub. Built by students, for students.
      </div>
    </footer>
  );
}
