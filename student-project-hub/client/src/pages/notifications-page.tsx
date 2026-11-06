import { BellOff, CheckCheck, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { useState } from 'react';
import { Pagination } from '@/components/common/pagination';
import { PageHeader } from '@/components/common/section';
import { EmptyState, ErrorState, PageLoader } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/misc';
import { useClearNotifications, useMarkAllRead, useNotifications } from '@/features/notifications/hooks';
import { NotificationItem } from '@/features/notifications/notification-item';
import { cn } from '@/utils/cn';

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, isLoading, error, refetch } = useNotifications(page, unreadOnly);
  const markAll = useMarkAllRead();
  const clearAll = useClearNotifications();
  const [confirmClear, setConfirmClear] = useState(false);
  const unreadCount = data?.meta.unreadCount ?? 0;
  // Total across all pages when viewing "All"; the button stays usable on "Unread" too.
  const hasAny = unreadOnly ? true : (data?.meta.total ?? 0) > 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description={unreadCount ? `You have ${unreadCount} unread notifications.` : 'You are all caught up.'}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => markAll.mutate()}
              disabled={!unreadCount}
              loading={markAll.isPending}
            >
              <CheckCheck /> Mark all as read
            </Button>
            <Button variant="outline" onClick={() => setConfirmClear(true)} disabled={!hasAny || clearAll.isPending}>
              <Trash2 /> Clear all
            </Button>
          </div>
        }
      />

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear all notifications?"
        description="This permanently deletes all your notifications, read and unread. Pending collaboration invites can still be answered from your home page."
        confirmLabel="Clear all"
        destructive
        loading={clearAll.isPending}
        onConfirm={() =>
          clearAll.mutate(undefined, {
            onSuccess: () => {
              setConfirmClear(false);
              setPage(1);
            },
          })
        }
      />

      <div className="mb-4 inline-flex rounded-lg border p-0.5" role="tablist">
        {[
          { value: false, label: 'All' },
          { value: true, label: 'Unread' },
        ].map((f) => (
          <button
            key={f.label}
            role="tab"
            aria-selected={unreadOnly === f.value}
            onClick={() => {
              setUnreadOnly(f.value);
              setPage(1);
            }}
            className={cn(
              'rounded-md px-3 py-1 text-sm font-medium transition-colors',
              unreadOnly === f.value ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={BellOff}
          title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          description="Likes, comments, replies and collaboration invites will show up here."
        />
      ) : (
        <>
          <Card className="divide-y overflow-hidden p-0">
            {data.items.map((n) => (
              <NotificationItem key={n.id} notification={n} />
            ))}
          </Card>
          <div className="mt-6">
            <Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
