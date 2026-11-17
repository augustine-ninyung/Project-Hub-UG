import { Check, ChevronDown } from 'lucide-react';
import { Select as S } from 'radix-ui';
import { cn } from '@/utils/cn';

export interface SelectOption {
  value: string;
  label: string;
}

// Radix reserves "" for "nothing selected", but our "Any …" options use "".
const EMPTY = '__any__';
const toRadix = (v: string) => (v === '' ? EMPTY : v);
const fromRadix = (v: string) => (v === EMPTY ? '' : v);

/**
 * Themed dropdown for filters and sorting. The list is drawn by the site, not
 * the browser, so it follows light and dark mode and matches the other menus.
 * The first option is the default; any other choice tints the button so
 * active filters stand out.
 */
export function SelectMenu({
  value,
  onValueChange,
  options,
  className,
  'aria-label': ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  'aria-label': string;
}) {
  const active = options.length > 0 && value !== options[0]!.value;
  return (
    <S.Root value={toRadix(value)} onValueChange={(v) => onValueChange(fromRadix(v))}>
      <S.Trigger
        aria-label={ariaLabel}
        data-active={active}
        className={cn(
          'group inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,background-color,border-color,box-shadow] duration-150',
          'hover:border-ring/50 hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/60',
          'data-[state=open]:border-ring data-[state=open]:ring-2 data-[state=open]:ring-ring/30',
          'data-[active=true]:border-primary/40 data-[active=true]:bg-primary/5 data-[active=true]:text-foreground',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <span className="truncate">
          <S.Value />
        </span>
        <S.Icon asChild>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-smooth group-data-[state=open]:rotate-180 group-data-[active=true]:text-primary"
            aria-hidden
          />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) origin-(--radix-select-content-transform-origin) overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-scale-in"
        >
          <S.ScrollUpButton className="flex h-6 items-center justify-center text-muted-foreground">
            <ChevronDown className="size-4 rotate-180" aria-hidden />
          </S.ScrollUpButton>
          <S.Viewport className="p-1">
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={toRadix(o.value)}
                className="relative flex cursor-pointer select-none items-center gap-2 rounded-md py-1.5 pl-2 pr-8 text-sm outline-none transition-colors duration-100 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[state=checked]:font-medium data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              >
                <S.ItemText>{o.label}</S.ItemText>
                <S.ItemIndicator className="absolute right-2 inline-flex items-center text-primary">
                  <Check className="size-4" aria-hidden />
                </S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
          <S.ScrollDownButton className="flex h-6 items-center justify-center text-muted-foreground">
            <ChevronDown className="size-4" aria-hidden />
          </S.ScrollDownButton>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
