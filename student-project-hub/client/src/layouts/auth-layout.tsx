import { Outlet } from 'react-router-dom';
import { Logo } from '@/components/layout/logo';

export function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm animate-fade-in">
            <Outlet />
          </div>
        </div>
      </div>
      <aside className="relative hidden overflow-hidden border-l bg-muted/40 lg:flex lg:flex-col lg:justify-end lg:p-12">
        <div
          aria-hidden
          className="absolute inset-0 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px]"
        />
        <div className="relative max-w-md space-y-4">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">
            Built by students, for students
          </p>
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Show what you've built. Find people to build with.
          </h2>
          <p className="text-muted-foreground">
            Share your projects, get feedback from peers across universities, and discover
            collaborators for your next idea.
          </p>
        </div>
      </aside>
    </div>
  );
}
