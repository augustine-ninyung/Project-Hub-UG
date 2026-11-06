import { Lock, MessageCircle, Star } from 'lucide-react';
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Skeleton, UserAvatar } from '@/components/ui/misc';
import type { ProjectCard as ProjectCardType } from '@/types/api';
import { cn } from '@/utils/cn';
import { compactNumber, STATUS_LABELS, timeAgo } from '@/utils/format';
import { LikeButton } from './like-button';

export const statusVariant = {
  PLANNING: 'secondary',
  ONGOING: 'warning',
  COMPLETED: 'success',
} as const;

/** Placeholder for projects without a cover image. */
export function CoverFallback({ title, className }: { title: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex size-full items-center justify-center bg-muted [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px]',
        className,
      )}
    >
      <span className="font-mono text-3xl font-semibold text-muted-foreground/60">
        {title.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
}

export const ProjectCard = memo(function ProjectCard({ project }: { project: ProjectCardType }) {
  const visibleTech = project.technologies.slice(0, 3);
  const extraTech = project.technologies.length - visibleTech.length;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-[transform,box-shadow,border-color] duration-200 ease-smooth hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-md focus-within:ring-2 focus-within:ring-ring motion-reduce:hover:translate-y-0">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {project.coverImageUrl ? (
          <img
            src={project.coverImageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-500 ease-smooth group-hover:scale-[1.03]"
          />
        ) : (
          <CoverFallback title={project.title} />
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          {project.isFeatured && (
            <Badge className="bg-background/90 text-foreground shadow-sm backdrop-blur">
              <Star className="fill-warning text-warning" /> Featured
            </Badge>
          )}
          {project.visibility === 'PRIVATE' && (
            <Badge className="bg-background/90 text-foreground shadow-sm backdrop-blur">
              <Lock /> Private
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{project.category.name}</span>
          <Badge variant={statusVariant[project.status]}>{STATUS_LABELS[project.status]}</Badge>
        </div>

        <div className="space-y-1.5">
          <h3 className="line-clamp-2 font-semibold leading-snug tracking-tight">
            <Link
              to={`/projects/${project.id}`}
              className="after:absolute after:inset-0 focus-visible:outline-none"
            >
              {project.title}
            </Link>
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">{project.excerpt}</p>
        </div>

        {visibleTech.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Technologies">
            {visibleTech.map((t) => (
              <li
                key={t.id}
                className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-secondary-foreground"
              >
                {t.name}
              </li>
            ))}
            {extraTech > 0 && (
              <li className="px-1 py-0.5 font-mono text-[11px] text-muted-foreground">+{extraTech}</li>
            )}
          </ul>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
          <Link
            to={`/u/${project.owner.username}`}
            className="relative z-10 flex min-w-0 items-center gap-2 rounded-md text-sm hover:text-primary"
          >
            <UserAvatar user={project.owner} size="xs" />
            <span className="truncate font-medium">{project.owner.fullName}</span>
          </Link>
          <div className="flex shrink-0 items-center text-muted-foreground">
            <LikeButton
              projectId={project.id}
              liked={project.likedByMe}
              count={project.likeCount}
              variant="compact"
            />
            <span
              className="inline-flex items-center gap-1 px-1.5 text-xs tabular-nums"
              aria-label={`${project.commentCount} comments`}
            >
              <MessageCircle className="size-3.5" aria-hidden />
              {compactNumber(project.commentCount)}
            </span>
          </div>
        </div>
        <time dateTime={project.createdAt} className="sr-only">
          {timeAgo(project.createdAt)}
        </time>
      </div>
    </article>
  );
});

export function ProjectCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Skeleton className="aspect-[16/10] rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-full" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-6 w-1/2" />
      </div>
    </div>
  );
}
