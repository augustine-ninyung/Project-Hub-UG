import { LogOut, Menu, Moon, Plus, Search, Settings, Shield, Sun, User } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/ui/misc';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/context/theme-context';
import { NotificationDropdown } from '@/features/notifications/notification-dropdown';
import { Logo } from './logo';

export function SearchBar({ className }: { className?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [value, setValue] = useState('');

  // Mirror the explore page's search term when on that page.
  useEffect(() => {
    setValue(location.pathname === '/explore' ? (params.get('search') ?? '') : '');
  }, [location.pathname, params]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(location.pathname === '/explore' ? params : undefined);
    if (value.trim()) next.set('search', value.trim());
    else next.delete('search');
    next.delete('page');
    navigate(`/explore?${next.toString()}`);
  };

  return (
    <form onSubmit={submit} role="search" className={className}>
      <label htmlFor="global-search" className="sr-only">
        Search projects
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="global-search"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search projects…"
          className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        />
      </div>
    </form>
  );
}

export function Navbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:gap-3 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="-ml-2 md:hidden"
        onClick={onOpenMenu}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>
      <Logo className="md:hidden" compact />

      <SearchBar className="hidden max-w-md flex-1 sm:block" />
      <div className="flex-1 sm:hidden" />

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" className="sm:hidden" asChild>
          <Link to="/explore" aria-label="Search projects">
            <Search className="size-[18px]" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </Button>

        {isAuthenticated && user ? (
          <>
            <Button asChild size="sm" className="mx-1 hidden md:inline-flex">
              <Link to="/projects/new">
                <Plus /> Upload
              </Link>
            </Button>
            <NotificationDropdown />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label="Account menu"
                >
                  <UserAvatar user={user} size="sm" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate font-medium">{user.fullName}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    @{user.username}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate(`/u/${user.username}`)}>
                  <User /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate('/settings')}>
                  <Settings /> Settings
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onSelect={() => navigate('/admin')}>
                    <Shield /> Admin dashboard
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <>
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to="/register">Join</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
