import { Heart, MessageCircle, Reply, UserCheck, UserPlus, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/misc';
import type { Notification, NotificationType } from '@/types/api';
import { cn } from '@/utils/cn';
import { timeAgo } from '@/utils/format';
import { useInvitations, useMarkRead, useRespondToInvitation } from './hooks';

const ICONS: Record<NotificationType, { icon: LucideIcon; className: string }> = {
  PROJECT_LIKED: { icon: Heart, className: 'bg-like text-white' },
  PROJECT_COMMENTED: { icon: MessageCircle, className: 'bg-primary text-primary-foreground' },
  COMMENT_REPLIED: { icon: Reply, className: 'bg-primary text-primary-foreground' },
  CONTRIBUTOR_INVITED: { icon: UserPlus, className: 'bg-warning text-white' },
  CONTRIBUTOR_RESPONDED: { icon: UserCheck, className: 'bg-success text-white' },
};

export function NotificationItem({
  notification,
  onNavigate,
}: {
  notification: Notification;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const markRead = useMarkRead();
  const { data: invitations } = useInvitations();
  const respond = useRespondToInvitation();
  const { icon: Icon, className } = ICONS[notification.type];
  const unread = !notification.readAt;

  const pendingInvite =
    notification.type === 'CONTRIBUTOR_INVITED' &&
    invitations?.some((i) => i.project.id === notification.projectId);

  const open = () => {
    if (unread) markRead.mutate(notification.id);
    if (notification.projectId) {
      navigate(
        `/projects/${notification.projectId}${notification.commentId ? '#comments' : ''}`,
      );
      onNavigate?.();
    }
  };

  const answer = (status: 'ACCEPTED' | 'DECLINED') => {
    respond.mutate({ projectId: notification.projectId!, status });
    if (unread) markRead.mutate(notification.id);
  };

  const actorName = notification.actor?.fullName ?? 'Someone';

  return (
    <div
      className={cn(
        'relative flex gap-3 px-4 py-3 transition-colors hover:bg-accent/60',
        unread && 'bg-primary/[0.04]',
      )}
    >
      <div className="relative shrink-0">
        <UserAvatar user={notification.actor ?? { fullName: '?', avatarUrl: null }} size="md" />
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full ring-2 ring-popover',
            className,
          )}
        >
          <Icon className="size-3" aria-hidden />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={open}
          className="text-left text-sm leading-snug after:absolute after:inset-0 focus-visible:outline-none"
        >
          <span className="font-semibold">{actorName}</span>{' '}
          <span className="text-muted-foreground">{notification.message}</span>
        </button>
        <p className="mt-1 text-xs text-muted-foreground">{timeAgo(notification.createdAt)}</p>
        {pendingInvite && (
          <div className="relative z-10 mt-2 flex gap-2">
            <Button size="sm" onClick={() => answer('ACCEPTED')} disabled={respond.isPending}>
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => answer('DECLINED')}
              disabled={respond.isPending}
            >
              Decline
            </Button>
          </div>
        )}
      </div>
      {unread && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
      )}
    </div>
  );
}
