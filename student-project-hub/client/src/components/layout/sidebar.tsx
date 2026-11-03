import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { useUnreadCount } from '@/features/notifications/hooks';
import { navItems } from '@/layouts/nav-items';
import { metaService } from '@/services/project.service';
import { cn } from '@/utils/cn';
import { Logo } from './logo';

interface SidebarNavProps {
  /** Icon-only rail (tablet). */
  collapsed?: boolean;
  onNavigate?: () => void;
}

/** Navigation content shared by the desktop sidebar and the mobile sheet. */
export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const unread = useUnreadCount();
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: metaService.categories,
    staleTime: 5 * 60_000,
  });

  const items = navItems(user?.username).filter(
    (i) => (!i.auth || isAuthenticated) && (!i.admin || isAdmin),
  );

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-14 items-center', collapsed ? 'justify-center' : 'px-4')}>
        <Logo compact={collapsed} />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main">
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.label}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                    isActive && 'bg-accent text-foreground',
                    collapsed && 'justify-center px-0',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={cn('size-[18px] shrink-0', isActive && 'text-primary')}
                      aria-hidden
                    />
                    {!collapsed && <span>{item.label}</span>}
                    {item.to === '/notifications' && unread > 0 && (
                      <span
                        className={cn(
                          'flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground',
                          collapsed ? 'absolute -right-0.5 -top-0.5 min-w-4 px-1 leading-4' : 'ml-auto',
                        )}
                      >
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        {!collapsed && categories && categories.length > 0 && (
          <div>
            <h2 className="px-2.5 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Categories
            </h2>
            <ul className="space-y-0.5">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/explore?category=${c.slug}`}
                    onClick={onNavigate}
                    className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <span className="truncate">{c.name}</span>
                    {!!c.projectCount && (
                      <span className="text-xs tabular-nums">{c.projectCount}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      <div className={cn('border-t p-3', collapsed && 'flex justify-center')}>
        <Button
          asChild
          className={cn(!collapsed && 'w-full')}
          size={collapsed ? 'icon' : 'default'}
        >
          <Link
            to={isAuthenticated ? '/projects/new' : '/login'}
            onClick={onNavigate}
            title="Share a project"
          >
            <Plus />
            {!collapsed && 'Share a project'}
          </Link>
        </Button>
      </div>
    </div>
  );
}
