import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Skeleton, UserAvatar } from '@/components/ui/misc';
import { userService } from '@/services/user.service';
import { timeAgo } from '@/utils/format';

export function ActiveStudents() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['users', 'active'],
    queryFn: () => userService.active(6),
  });

  if (isError) return <p className="text-sm text-muted-foreground">Could not load students.</p>;

  return (
    <ul className="space-y-3">
      {isLoading
        ? Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </li>
          ))
        : data?.map((u) => (
            <li key={u.id}>
              <Link
                to={`/u/${u.username}`}
                className="group flex items-center gap-3 rounded-md"
              >
                <span className="relative">
                  <UserAvatar user={u} size="sm" className="size-9" />
                  {Date.now() - new Date(u.lastActiveAt).getTime() < 15 * 60_000 && (
                    <span
                      className="absolute bottom-0 right-0 size-2.5 rounded-full bg-success ring-2 ring-card"
                      aria-label="Active now"
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium group-hover:text-primary">
                    {u.fullName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {u.university} · {timeAgo(u.lastActiveAt)}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {u.projectCount} {u.projectCount === 1 ? 'project' : 'projects'}
                </span>
              </Link>
            </li>
          ))}
    </ul>
  );
}
