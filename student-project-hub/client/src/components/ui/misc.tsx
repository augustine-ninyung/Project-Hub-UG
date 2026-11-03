import { cva, type VariantProps } from 'class-variance-authority';
import { Avatar as AvatarPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/utils/cn';
import { initials } from '@/utils/format';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/10 text-primary',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-muted-foreground',
        success: 'border-transparent bg-success/15 text-success',
        warning: 'border-transparent bg-warning/15 text-warning',
        destructive: 'border-transparent bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const avatarSizes = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-16 text-lg',
  xl: 'size-24 text-2xl',
};

export function UserAvatar({
  user,
  size = 'sm',
  className,
}: {
  user: { fullName: string; avatarUrl: string | null };
  size?: keyof typeof avatarSizes;
  className?: string;
}) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative inline-flex shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border',
        avatarSizes[size],
        className,
      )}
    >
      {user.avatarUrl && (
        <AvatarPrimitive.Image
          src={user.avatarUrl}
          alt={user.fullName}
          className="size-full object-cover"
          loading="lazy"
        />
      )}
      <AvatarPrimitive.Fallback
        className="flex size-full items-center justify-center bg-primary/10 font-semibold text-primary"
        delayMs={user.avatarUrl ? 400 : 0}
      >
        {initials(user.fullName)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-xl border bg-card text-card-foreground shadow-xs', className)}
      {...props}
    />
  );
}

export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn('h-px w-full bg-border', className)} />;
}
