import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from '@/components/layout/navbar';
import { SidebarNav } from '@/components/layout/sidebar';
import { VerifyEmailBanner } from '@/components/layout/verify-banner';
import { Dialog, SheetContent } from '@/components/ui/dialog';

/**
 * Desktop (lg+): full sidebar. Tablet (md): icon rail. Mobile: top bar with a
 * slide-in navigation sheet.
 */
export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

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

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 border-r bg-background md:block lg:w-60">
        <div className="h-full lg:hidden">
          <SidebarNav collapsed />
        </div>
        <div className="hidden h-full lg:block">
          <SidebarNav />
        </div>
      </aside>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent title="Navigation">
          <SidebarNav onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Dialog>

      <div className="md:pl-16 lg:pl-60">
        <Navbar onOpenMenu={() => setMenuOpen(true)} />
        <VerifyEmailBanner />
        <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-8 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
