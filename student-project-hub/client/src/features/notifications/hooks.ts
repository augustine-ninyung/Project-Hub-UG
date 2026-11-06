import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/context/auth-context';
import { getErrorMessage } from '@/services/api';
import { projectService } from '@/services/project.service';
import { notificationService, userService } from '@/services/user.service';

const UNREAD_KEY = ['notifications', 'unread'] as const;

/** Polls the unread count while signed in. */
export function useUnreadCount() {
  const { isAuthenticated } = useAuth();
  const { data = 0 } = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: notificationService.unreadCount,
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  return isAuthenticated ? data : 0;
}

export function useNotifications(page: number, unreadOnly = false, enabled = true) {
  return useQuery({
    queryKey: ['notifications', 'list', page, unreadOnly],
    queryFn: () => notificationService.list(page, unreadOnly),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationService.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}

export function useClearNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationService.clearAll,
    onSuccess: () => {
      toast.success('Notifications cleared');
      return queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}

export function useInvitations() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['invitations'],
    queryFn: userService.invitations,
    enabled: isAuthenticated,
  });
}

export function useRespondToInvitation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ projectId, status }: { projectId: string; status: 'ACCEPTED' | 'DECLINED' }) =>
      projectService.respondToInvitation(projectId, user!.id, status),
    onSuccess: (_data, { projectId, status }) => {
      toast.success(status === 'ACCEPTED' ? 'You joined the project' : 'Invitation declined');
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
