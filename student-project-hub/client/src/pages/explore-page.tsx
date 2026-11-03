import { Search, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pagination } from '@/components/common/pagination';
import { PageHeader } from '@/components/common/section';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form-controls';
import { useCategories, useProjects, useTechnologies } from '@/features/projects/hooks';
import { ProjectGrid } from '@/features/projects/project-grid';
import type { ProjectSort } from '@/services/project.service';
import { cn } from '@/utils/cn';

const SORTS: { value: ProjectSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'most_liked', label: 'Most liked' },
  { value: 'most_commented', label: 'Most discussed' },
];

const PAGE_SIZE = 12;

/** Filters live in the URL so results are shareable and survive refreshes. */
export default function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const category = params.get('category') ?? '';
  const technology = params.get('technology') ?? '';
  const sort = (params.get('sort') as ProjectSort) || 'newest';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => setSearchInput(search), [search]);

  const categories = useCategories();
  const technologies = useTechnologies();
  const projects = useProjects({
    search: search || undefined,
    category: category || undefined,
    technology: technology || undefined,
    sort,
    page,
    limit: PAGE_SIZE,
  });

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  // Debounce typing into the search box.
  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => update({ search: searchInput.trim() || null }), 350);
    return () => clearTimeout(t);
  }, [searchInput]); // `update` and `search` are read fresh from this render.

  const hasFilters = Boolean(search || category || technology);
  const total = projects.data?.meta.total;
  const activeCategory = categories.data?.find((c) => c.slug === category);

  return (
    <div>
      <PageHeader
        title={activeCategory?.name ?? 'Explore projects'}
        description={
          activeCategory?.description ?? 'Discover what students across universities are building.'
        }
      />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Categories">
        <CategoryChip active={!category} onClick={() => update({ category: null })}>
          All
        </CategoryChip>
        {categories.data?.map((c) => (
          <CategoryChip key={c.id} active={category === c.slug} onClick={() => update({ category: c.slug })}>
            {c.name}
          </CategoryChip>
        ))}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_200px_170px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by title or description"
            className="pl-9"
            aria-label="Search projects"
          />
        </div>
        <Select
          value={technology}
          onChange={(e) => update({ technology: e.target.value || null })}
          aria-label="Filter by technology"
        >
          <option value="">All technologies</option>
          {technologies.data?.map((t) => (
            <option key={t.id} value={t.slug}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort projects">
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="mb-4 flex min-h-8 items-center justify-between gap-2 text-sm text-muted-foreground">
        <span aria-live="polite">
          {total !== undefined && `${total} ${total === 1 ? 'project' : 'projects'}`}
        </span>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setParams(sort !== 'newest' ? { sort } : {})}
          >
            <X /> Clear filters
          </Button>
        )}
      </div>

      <div className={cn('transition-opacity', projects.isPlaceholderData && 'opacity-60')}>
        <ProjectGrid
          projects={projects.data?.items}
          isLoading={projects.isLoading}
          error={projects.error}
          onRetry={() => projects.refetch()}
          skeletonCount={PAGE_SIZE}
          empty={{
            title: 'No matching projects',
            description: hasFilters
              ? 'Try a different search term or remove some filters.'
              : 'No projects have been shared yet.',
          }}
        />
      </div>

      {projects.data && (
        <div className="mt-8">
          <Pagination
            page={page}
            totalPages={projects.data.meta.totalPages}
            onChange={(p) => {
              update({ page: String(p) });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'text-muted-foreground hover:border-foreground/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
