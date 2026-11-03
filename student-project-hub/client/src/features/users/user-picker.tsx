import { useQuery } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Input } from '@/components/ui/form-controls';
import { UserAvatar } from '@/components/ui/misc';
import { userService } from '@/services/user.service';
import type { UserSummary } from '@/types/api';

function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Searches students by name/username for contributor invitations. */
export function UserPicker({
  onSelect,
  excludeIds = [],
  placeholder = 'Search students by name or username',
}: {
  onSelect: (user: UserSummary) => void;
  excludeIds?: string[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const term = useDebounced(query.trim());
  const listId = useId();

  const { data, isFetching } = useQuery({
    queryKey: ['users', 'search', term],
    queryFn: () => userService.search(term),
    enabled: term.length >= 2,
    staleTime: 60_000,
  });
  const results = (data ?? []).filter((u) => !excludeIds.includes(u.id));

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="pl-9"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
      />
      {isFetching && (
        <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {open && term.length >= 2 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
        >
          {results.length === 0 && !isFetching ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No students found</li>
          ) : (
            results.map((u) => (
              <li key={u.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(u);
                    setQuery('');
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                >
                  <UserAvatar user={u} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{u.fullName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      @{u.username} · {u.university}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
