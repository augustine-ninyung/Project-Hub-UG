import { Bell, BellOff } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/misc';
import { useMarkAllRead, useNotifications, useUnreadCount } from './hooks';
import { NotificationItem } from './notification-item';

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount();
  const { data, isLoading } = useNotifications(1, false, open);
  const markAll = useMarkAllRead();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative data-[state=open]:bg-accent"
          aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
        >
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span
              key={unread}
              className="absolute right-1 top-1 flex min-w-4 animate-pop items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground ring-2 ring-background"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(24rem,calc(100vw-1rem))]">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            disabled={!unread || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all as read
          </Button>
        </div>
        <div className="max-h-[26rem] divide-y overflow-y-auto">
          {isLoading ? (
            Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex gap-3 px-4 py-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-4/5" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))
          ) : data?.items.length ? (
            data.items.slice(0, 8).map((n) => (
              <NotificationItem key={n.id} notification={n} onNavigate={() => setOpen(false)} />
            ))
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <BellOff className="size-5 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">You're all caught up</p>
            </div>
          )}
        </div>
        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
