import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from '@/components/layout/navbar';
import { SidebarNav } from '@/components/layout/sidebar';
import { VerifyEmailBanner } from '@/components/layout/verify-banner';
import { Dialog, SheetContent } from '@/components/ui/dialog';
import { LiveNotifications } from '@/features/notifications/live-notifications';
import { LiveFeed } from '@/features/projects/live-feed';
import { cn } from '@/utils/cn';
import { isTypingTarget } from '@/utils/keyboard';

const COLLAPSE_KEY = 'sidebar-collapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Ctrl/Cmd+B toggles the desktop sidebar, unless the user is typing. */
function useSidebarCollapse() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* storage unavailable: the choice just isn't remembered */
    }
  }, [collapsed]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b' && !isTypingTarget(e.target)) {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return [collapsed, () => setCollapsed((c) => !c)] as const;
}

/**
 * Gentle fade-up of the page content on navigation. Done with the Web
 * Animations API on a stable element, so pages are not remounted (their state
 * and scroll handling are untouched). Skipped for reduced-motion users and for
 * query-string-only changes such as filters.
 */
function usePageTransition(pathname: string) {
  const ref = useRef<HTMLElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    if (!el?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.animate(
      [
        { opacity: 0, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  }, [pathname]);
  return ref;
}

/**
 * Desktop (lg+): full sidebar that can collapse to an icon rail. Tablet (md):
 * icon rail. Mobile: top bar with a slide-in navigation sheet.
 */
export function AppLayout({ children }: { children?: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, toggleCollapsed] = useSidebarCollapse();
  const { pathname } = useLocation();
  const mainRef = usePageTransition(pathname);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden w-16 border-r bg-background transition-[width] duration-300 ease-smooth md:block',
          collapsed ? 'lg:w-16' : 'lg:w-60',
        )}
      >
        <div className="h-full lg:hidden">
          <SidebarNav collapsed />
        </div>
        <div className="hidden h-full lg:block">
          <SidebarNav collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
        </div>
      </aside>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent title="Navigation">
          <SidebarNav onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Dialog>

      <LiveNotifications />
      <LiveFeed />

      <div
        className={cn(
          'transition-[padding] duration-300 ease-smooth md:pl-16',
          collapsed ? 'lg:pl-16' : 'lg:pl-60',
        )}
      >
        <Navbar onOpenMenu={() => setMenuOpen(true)} />
        <VerifyEmailBanner />
        <main ref={mainRef} id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-8 lg:px-8">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
