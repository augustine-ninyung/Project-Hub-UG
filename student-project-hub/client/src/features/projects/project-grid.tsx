import { FolderOpen } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { EmptyState, ErrorState } from '@/components/common/states';
import type { ProjectCard as ProjectCardType } from '@/types/api';
import { cn } from '@/utils/cn';
import { ProjectCard, ProjectCardSkeleton } from './project-card';

interface ProjectGridProps {
  projects: ProjectCardType[] | undefined;
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
  skeletonCount?: number;
  empty?: { title: string; description?: string; action?: ReactNode };
  /** Most columns to use when there is room (cards never get narrower than ~260px). */
  columns?: 3 | 4;
  /** 'row': one swipeable line of cards, for short curated lists of any length. */
  layout?: 'grid' | 'row';
  className?: string;
}

/**
 * Columns follow the width the grid actually gets (container queries), not the
 * screen: beside the home sidebar it shows two roomy cards, on Explore three.
 */
const gridClass = {
  3: 'grid gap-5 @xl:grid-cols-2 @3xl:grid-cols-3',
  4: 'grid gap-5 @xl:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4',
};

const rowClass =
  'flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-1 px-1 pt-1 pb-3 -mx-1 -mt-1 [scrollbar-width:thin]';
const rowItemClass = 'w-[min(20rem,85%)] shrink-0 snap-start';

/** Cards fade up one after another; capped so long lists don't lag behind. */
const stagger = (i: number): CSSProperties => ({ animationDelay: `${Math.min(i, 8) * 45}ms` });

export function ProjectGrid({
  projects,
  isLoading,
  error,
  onRetry,
  skeletonCount = 6,
  empty = { title: 'No projects yet' },
  columns = 3,
  layout = 'grid',
  className,
}: ProjectGridProps) {
  const listClass = layout === 'row' ? rowClass : gridClass[columns];
  const itemClass = layout === 'row' ? rowItemClass : '';
  if (isLoading) {
    return (
      <div className={cn('@container', className)}>
        <div className={listClass} aria-busy="true" aria-label="Loading projects">
          {Array.from({ length: skeletonCount }, (_, i) => (
            <div key={i} className={itemClass}>
              <ProjectCardSkeleton />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={onRetry} title="Could not load projects" />;
  if (!projects?.length) return <EmptyState icon={FolderOpen} {...empty} />;

  return (
    <div className={cn('@container', className)}>
      <div className={listClass}>
        {projects.map((p, i) => (
          // Only newly mounted cards animate; live refreshes keep existing ones still.
          <div key={p.id} className={cn('flex animate-fade-up *:flex-1', itemClass)} style={stagger(i)}>
            <ProjectCard project={p} />
          </div>
        ))}
      </div>
    </div>
  );
}
