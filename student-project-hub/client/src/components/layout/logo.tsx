import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

/** Monogram: a geometric "P" with a hub dot, on a clay tile. Also used as the favicon. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8 shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <path
        d="M11 23.5V8.5h5.75a4.75 4.75 0 0 1 0 9.5H11"
        fill="none"
        className="stroke-ink"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="21.75" cy="22.25" r="1.9" className="fill-ink" />
    </svg>
  );
}

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link
      to="/"
      className={cn('flex items-center gap-2.5 rounded-md', className)}
      aria-label="ProjectHub home"
    >
      <LogoMark />
      {!compact && (
        <span className="font-display text-[19px] font-semibold leading-none tracking-[-0.01em]">
          ProjectHub
        </span>
      )}
    </Link>
  );
}
