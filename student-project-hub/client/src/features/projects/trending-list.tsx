import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/misc';
import type { ProjectCard } from '@/types/api';
import { compactNumber } from '@/utils/format';
import { CoverFallback } from './project-card';

/** Compact ranked list used in the dashboard sidebar. */
export function TrendingList({ projects, isLoading }: { projects?: ProjectCard[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <ol className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-14 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </li>
        ))}
      </ol>
    );
  }
  if (!projects?.length) {
    return <p className="text-sm text-muted-foreground">Nothing trending yet.</p>;
  }
  return (
    <ol className="space-y-1">
      {projects.map((p, i) => (
        <li key={p.id}>
          <Link
            to={`/projects/${p.id}`}
            className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
          >
            <span className="w-4 shrink-0 text-center font-mono text-sm text-muted-foreground">
              {i + 1}
            </span>
            <span className="h-10 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
              {p.coverImageUrl ? (
                <img src={p.coverImageUrl} alt="" loading="lazy" className="size-full object-cover" />
              ) : (
                <CoverFallback title={p.title} className="[&_span]:text-xs" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-1 text-sm font-medium group-hover:text-primary">
                {p.title}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Heart className="size-3" aria-hidden /> {compactNumber(p.likeCount)} ·{' '}
                {p.owner.fullName}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
