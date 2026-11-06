import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/services/api';
import { metaService, projectService, type ProjectFilters } from '@/services/project.service';
import type { ProjectDetail } from '@/types/api';

export const projectKeys = {
  all: ['projects'] as const,
  list: (filters: ProjectFilters) => ['projects', 'list', filters] as const,
  /** Includes the size, so pages asking for different counts don't share a cache entry. */
  section: (name: string, limit: number) => ['projects', name, limit] as const,
  detail: (id: string) => ['project', id] as const,
  related: (id: string) => ['project', id, 'related'] as const,
  comments: (id: string) => ['project', id, 'comments'] as const,
};

export function useProjects(filters: ProjectFilters) {
  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: () => projectService.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useTrendingProjects(limit = 6) {
  return useQuery({ queryKey: projectKeys.section('trending', limit), queryFn: () => projectService.trending(limit) });
}

export function useFeaturedProjects(limit = 6) {
  return useQuery({ queryKey: projectKeys.section('featured', limit), queryFn: () => projectService.featured(limit) });
}

export function useRecommendedProjects(limit = 6) {
  return useQuery({
    queryKey: projectKeys.section('recommended', limit),
    queryFn: () => projectService.recommended(limit),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? ''),
    queryFn: () => projectService.get(id!),
    enabled: Boolean(id),
  });
}

export function useRelatedProjects(id: string) {
  return useQuery({ queryKey: projectKeys.related(id), queryFn: () => projectService.related(id) });
}

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: metaService.categories, staleTime: 5 * 60_000 });
}

export function useCommunityStats() {
  return useQuery({ queryKey: ['stats'], queryFn: metaService.stats, staleTime: 60_000 });
}

export function useTechnologies(search = '') {
  return useQuery({
    queryKey: ['technologies', search],
    queryFn: () => metaService.technologies(search),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

/** Like/unlike, applying the server's authoritative count to cached detail. */
export function useToggleLike(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (like: boolean) =>
      like ? projectService.like(projectId) : projectService.unlike(projectId),
    onSuccess: (result) => {
      queryClient.setQueryData<ProjectDetail>(projectKeys.detail(projectId), (p) =>
        p ? { ...p, likedByMe: result.liked, likeCount: result.likeCount } : p,
      );
      // Lists and dashboard sections will pick up the new count on next view.
      queryClient.invalidateQueries({ queryKey: projectKeys.all, refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['profile'], refetchType: 'none' });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectService.remove,
    onSuccess: (_d, id) => {
      queryClient.removeQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Project deleted');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
