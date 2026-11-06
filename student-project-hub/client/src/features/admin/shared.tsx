import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Input } from '@/components/ui/form-controls';
import { Card, Skeleton } from '@/components/ui/misc';
import { getErrorMessage } from '@/services/api';
import { cn } from '@/utils/cn';

/**
 * Filters, search and page live in the address bar, so a refresh, a shared
 * link or the back button keeps the admin's place. Empty values (and page 1)
 * are left out to keep URLs short.
 */
export function useUrlState() {
  const [params, setParams] = useSearchParams();
  const get = useCallback((key: string, fallback = '') => params.get(key) ?? fallback, [params]);
  const set = useCallback(
    (updates: Record<string, string | number | null | undefined>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === undefined || value === '' || (key === 'page' && value === 1)) {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          }
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  const page = Math.max(1, Number(params.get('page')) || 1);
  return { get, set, page };
}

/**
 * Search box bound to the `q` URL parameter, debounced so typing doesn't fire
 * a request per keystroke. Press "/" anywhere on the page to focus it.
 */
export function SearchInput({ placeholder }: { placeholder: string }) {
  const { get, set } = useUrlState();
  const urlValue = get('q');
  const [value, setValue] = useState(urlValue);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setValue(urlValue), [urlValue]);
  useEffect(() => {
    if (value === urlValue) return;
    const t = setTimeout(() => set({ q: value.trim() || null, page: null }), 300);
    return () => clearTimeout(t);
  }, [value, urlValue, set]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target?.closest('input, textarea, select, [contenteditable="true"]');
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="relative max-w-sm min-w-48 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setValue('')}
        placeholder={placeholder}
        className="pl-9 pr-9"
        aria-label={placeholder}
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:block">
        /
      </kbd>
    </div>
  );
}

/**
 * Admin table. While a new page or filter loads, the previous rows stay on
 * screen, slightly faded, instead of being replaced by a spinner.
 */
export function Table({
  head,
  children,
  busy = false,
}: {
  head: ReactNode[];
  children: ReactNode;
  busy?: boolean;
}) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[680px] text-sm" aria-busy={busy}>
        <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={cn('divide-y transition-opacity duration-200', busy && 'opacity-55')}>{children}</tbody>
      </table>
    </Card>
  );
}

/** Placeholder rows shown on first load, shaped like the real ones. */
export function SkeletonRows({ rows = 6, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} className="px-4 py-3.5">
              {c === 0 ? (
                <div className="flex items-center gap-3">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="w-full space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                </div>
              ) : (
                <Skeleton className="h-3.5" style={{ width: `${50 + ((r * 7 + c * 13) % 40)}%` }} />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="size-4 cursor-pointer rounded accent-primary disabled:cursor-not-allowed disabled:opacity-40"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={label}
    />
  );
}

/** "1 project", "3 projects". */
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

interface Page<T> {
  items: T[];
}

/**
 * A mutation that updates matching list rows in the cache straight away and
 * puts them back if the server refuses. Every admin query refreshes afterwards
 * so counts and badges catch up.
 */
export function useOptimisticRows<T extends { id: string }, V>({
  listKey,
  mutationFn,
  apply,
  success,
}: {
  listKey: QueryKey;
  mutationFn: (vars: V) => Promise<unknown>;
  /** Returns the updated row, `null` to remove it, or the row unchanged. */
  apply: (row: T, vars: V) => T | null;
  success?: string | ((vars: V) => string);
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (vars: V) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const snapshot = queryClient.getQueriesData<Page<T>>({ queryKey: listKey });
      queryClient.setQueriesData<Page<T>>({ queryKey: listKey }, (old) =>
        old
          ? { ...old, items: old.items.map((row) => apply(row, vars)).filter((r): r is T => r !== null) }
          : old,
      );
      return { snapshot };
    },
    onError: (err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(getErrorMessage(err));
    },
    onSuccess: (_data, vars) => {
      if (success) toast.success(typeof success === 'function' ? success(vars) : success);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}
