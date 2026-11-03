import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link
      to="/"
      className={cn('flex items-center gap-2.5 font-semibold tracking-tight', className)}
      aria-label="Student Project Hub home"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
          <path
            d="M9 11h14M9 16h9M9 21h11"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {!compact && <span className="text-[15px]">ProjectHub</span>}
    </Link>
  );
}
