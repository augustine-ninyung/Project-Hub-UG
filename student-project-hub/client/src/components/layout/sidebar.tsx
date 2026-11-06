import { useQuery } from '@tanstack/react-query';
import { ChevronsLeft, ChevronsRight, Plus } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/misc';
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/context/auth-context';
import { useUnreadCount } from '@/features/notifications/hooks';
import { navItems } from '@/layouts/nav-items';
import { metaService } from '@/services/project.service';
import { cn } from '@/utils/cn';
import { Logo } from './logo';

interface SidebarNavProps {
  /** Icon-only rail (tablet, or desktop when the user collapses it). */
  collapsed?: boolean;
  onNavigate?: () => void;
  /** Desktop only: shows the collapse/expand control. */
  onToggleCollapsed?: () => void;
}

/** Navigation content shared by the desktop sidebar and the mobile sheet. */
export function SidebarNav({ collapsed = false, onNavigate, onToggleCollapsed }: SidebarNavProps) {
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
    <TooltipProvider delayDuration={150} skipDelayDuration={300}>
      <div className="flex h-full flex-col">
        <div className={cn('flex h-14 shrink-0 items-center', collapsed ? 'justify-center' : 'px-4')}>
          <Logo compact={collapsed} />
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-3 py-4 [scrollbar-width:none] hover:[scrollbar-width:thin]" aria-label="Main">
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.label}>
                <Tooltip label={item.label} disabled={!collapsed}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    aria-label={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent/70 hover:text-foreground',
                        isActive && 'bg-accent text-foreground',
                        collapsed && 'justify-center px-0',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Active marker grows in from the centre of the item. */}
                        <span
                          aria-hidden
                          className={cn(
                            'absolute inset-y-2 -left-3 w-[3px] rounded-r-full bg-brand transition-transform duration-200 ease-smooth',
                            isActive ? 'scale-y-100' : 'scale-y-0',
                          )}
                        />
                        <item.icon
                          className={cn(
                            'size-[18px] shrink-0 transition-[color,transform] duration-150 group-hover:scale-105',
                            isActive && 'text-primary',
                          )}
                          aria-hidden
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {item.to === '/notifications' && unread > 0 && (
                          <span
                            key={unread}
                            className={cn(
                              'flex min-w-5 animate-pop items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground',
                              collapsed ? 'absolute right-0.5 top-0 min-w-4 px-1 text-[10px] leading-4' : 'ml-auto',
                            )}
                          >
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </Tooltip>
              </li>
            ))}
          </ul>

          {!collapsed && categories && categories.length > 0 && (
            <div>
              <h2 className="px-2.5 pb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Categories
              </h2>
              <ul className="space-y-0.5">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/explore?category=${c.slug}`}
                      onClick={onNavigate}
                      className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent/70 hover:text-foreground"
                    >
                      <span className="truncate">{c.name}</span>
                      {!!c.projectCount && <span className="text-xs tabular-nums">{c.projectCount}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>

        <div className={cn('shrink-0 space-y-1 border-t p-3', collapsed && 'flex flex-col items-center')}>
          {isAuthenticated && user ? (
            <Tooltip label={`${user.fullName} · @${user.username}`} disabled={!collapsed}>
              <Link
                to={`/u/${user.username}`}
                onClick={onNavigate}
                aria-label={collapsed ? 'Your profile' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-md p-1.5 transition-colors duration-150 hover:bg-accent/70',
                  !collapsed && 'w-full',
                )}
              >
                <UserAvatar user={user} size="sm" />
                {!collapsed && (
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-medium">{user.fullName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {isAdmin ? 'Admin' : `@${user.username}`}
                    </span>
                  </span>
                )}
              </Link>
            </Tooltip>
          ) : (
            <Button asChild className={cn(!collapsed && 'w-full')} size={collapsed ? 'icon' : 'default'}>
              <Link to="/login" onClick={onNavigate} aria-label={collapsed ? 'Share a project' : undefined}>
                <Plus />
                {!collapsed && 'Share a project'}
              </Link>
            </Button>
          )}
          {onToggleCollapsed && (
            <Tooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} disabled={!collapsed}>
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className={cn(
                  'flex h-8 items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors duration-150 hover:bg-accent/70 hover:text-foreground',
                  collapsed ? 'w-8 justify-center px-0' : 'w-full',
                )}
              >
                {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
                {!collapsed && 'Collapse'}
                {!collapsed && (
                  <kbd className="ml-auto rounded border bg-muted px-1 font-mono text-[10px]">Ctrl&nbsp;B</kbd>
                )}
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
