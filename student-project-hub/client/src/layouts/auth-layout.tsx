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
      <aside className="relative isolate hidden overflow-hidden bg-ink text-[#FAF9F5] lg:flex lg:flex-col lg:justify-end lg:p-12">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.1] [background-image:radial-gradient(#FAF9F5_1px,transparent_1px)] [background-size:22px_22px]"
        />
        <div
          aria-hidden
          className="absolute -right-32 -top-32 -z-10 size-[28rem] rounded-full bg-brand/30 blur-3xl"
        />
        <div className="relative max-w-md space-y-4">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-brand">
            <span aria-hidden className="h-px w-6 bg-brand" />
            Built by students, for students
          </p>
          <h2 className="font-display text-4xl font-medium leading-[1.1] tracking-tight">
            Show what you've built. <em className="font-normal italic text-brand">Find people to build with.</em>
          </h2>
          <p className="text-[#FAF9F5]/70">
            Share your projects, get feedback from peers across universities, and discover
            collaborators for your next idea.
          </p>
        </div>
      </aside>
    </div>
  );
}
