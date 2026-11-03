import { FolderOpen } from 'lucide-react';
import type { ReactNode } from 'react';
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
  className?: string;
}

const gridClass = 'grid gap-5 sm:grid-cols-2 xl:grid-cols-3';

export function ProjectGrid({
  projects,
  isLoading,
  error,
  onRetry,
  skeletonCount = 6,
  empty = { title: 'No projects yet' },
  className,
}: ProjectGridProps) {
  if (isLoading) {
    return (
      <div className={cn(gridClass, className)} aria-busy="true" aria-label="Loading projects">
        {Array.from({ length: skeletonCount }, (_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={onRetry} title="Could not load projects" />;
  if (!projects?.length) return <EmptyState icon={FolderOpen} {...empty} />;

  return (
    <div className={cn(gridClass, className)}>
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  );
}
