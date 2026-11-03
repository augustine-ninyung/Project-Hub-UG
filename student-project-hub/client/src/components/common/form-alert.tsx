import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function FormAlert({
  children,
  variant = 'error',
}: {
  children: ReactNode;
  variant?: 'error' | 'success';
}) {
  if (!children) return null;
  const Icon = variant === 'error' ? AlertCircle : CheckCircle2;
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex gap-2 rounded-md border px-3 py-2.5 text-sm',
        variant === 'error'
          ? 'border-destructive/30 bg-destructive/5 text-destructive'
          : 'border-success/30 bg-success/10 text-success',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
