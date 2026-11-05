import { useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AUTH_QUERY_KEY, useAuth } from '@/context/auth-context';
import { useLiveTopic } from '@/hooks/use-live-topic';
import { notificationService } from '@/services/user.service';

/**
 * Listens on the signed-in user's private topic. On a ping it refreshes the
 * bell and invitations, and announces the newest unread notification.
 */
export function LiveNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useLiveTopic(user?.realtimeTopic, async () => {
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    void queryClient.invalidateQueries({ queryKey: ['invitations'] });

    const latest = await queryClient.fetchQuery({
      queryKey: ['notifications', 'list', 1, true],
      queryFn: () => notificationService.list(1, true),
    });
    const newest = latest.items[0];
    if (!newest) return;
    // An admin verified this account: refresh it so posting unlocks and the
    // "verify your email" banner goes away without a reload.
    if (newest.type === 'ACCOUNT_VERIFIED') void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    toast(`${newest.actor?.fullName ?? 'Someone'} ${newest.message}`, {
      id: `notification-${newest.id}`,
      icon: <Bell className="size-4 text-primary" aria-hidden />,
      action: {
        label: 'View',
        onClick: () => navigate(newest.projectId ? `/projects/${newest.projectId}` : '/notifications'),
      },
    });
  });

  return null;
}
