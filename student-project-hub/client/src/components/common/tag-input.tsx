import { X } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';
import { cn } from '@/utils/cn';

interface TagInputProps {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  max?: number;
  invalid?: boolean;
  onQueryChange?: (query: string) => void;
}

/** Free-text tags with optional suggestions. Enter or comma adds a tag. */
export function TagInput({
  id,
  value,
  onChange,
  suggestions = [],
  placeholder,
  max = 15,
  invalid,
  onQueryChange,
}: TagInputProps) {
  const [query, setQuery] = useState('');
  const listId = useId();

  const add = (raw: string) => {
    const tag = raw.trim().replace(/,$/, '').slice(0, 40);
    if (!tag || value.length >= max) return;
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
    setQuery('');
    onQueryChange?.('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(query);
    } else if (e.key === 'Backspace' && !query && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const filtered = suggestions
    .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))
    .filter((s) => !query || s.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/60',
          invalid && 'border-destructive',
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== tag))}
              className="rounded-sm text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${tag}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onQueryChange?.(e.target.value);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => query && add(query)}
          placeholder={value.length >= max ? `Maximum of ${max}` : placeholder}
          disabled={value.length >= max}
          aria-invalid={invalid || undefined}
          aria-describedby={listId}
          className="min-w-32 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {filtered.length > 0 && (
        <div id={listId} className="flex flex-wrap gap-1.5" aria-label="Suggestions">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
