import { Tooltip as TooltipPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';

export const TooltipProvider = TooltipPrimitive.Provider;

/**
 * Small label shown on hover or keyboard focus, e.g. for icon-only buttons.
 * Pass `disabled` to render the trigger alone (when its label is visible).
 */
export function Tooltip({
  label,
  side = 'right',
  disabled = false,
  children,
}: {
  label: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  disabled?: boolean;
  children: ReactNode;
}) {
  if (disabled) return <>{children}</>;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          className="z-50 origin-(--radix-tooltip-content-transform-origin) rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-md data-[state=closed]:animate-fade-out data-[state=delayed-open]:animate-scale-in data-[state=instant-open]:animate-scale-in"
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
