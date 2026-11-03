import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectKeys } from '@/features/projects/hooks';
import { projectService } from '@/services/project.service';
import type { ProjectDetail } from '@/types/api';

export function useComments(projectId: string) {
  return useInfiniteQuery({
    queryKey: projectKeys.comments(projectId),
    queryFn: ({ pageParam }) => projectService.comments(projectId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
  });
}

/** Comment mutations refetch the thread so the UI reflects the server's state. */
export function useCommentMutations(projectId: string) {
  const queryClient = useQueryClient();
  const refresh = (delta: number) => {
    queryClient.invalidateQueries({ queryKey: projectKeys.comments(projectId) });
    if (delta) {
      queryClient.setQueryData<ProjectDetail>(projectKeys.detail(projectId), (p) =>
        p ? { ...p, commentCount: Math.max(0, p.commentCount + delta) } : p,
      );
    }
  };

  const add = useMutation({
    mutationFn: ({ content, parentId }: { content: string; parentId?: string }) =>
      projectService.addComment(projectId, content, parentId),
    onSuccess: () => refresh(1),
  });
  const edit = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      projectService.editComment(id, content),
    onSuccess: () => refresh(0),
  });
  const remove = useMutation({
    mutationFn: (id: string) => projectService.deleteComment(id),
    onSuccess: () => refresh(-1),
  });

  return { add, edit, remove };
}
