import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-controls';
import { UserAvatar } from '@/components/ui/misc';
import { useAuth } from '@/context/auth-context';
import { getErrorMessage } from '@/services/api';

const MAX = 2000;

interface CommentComposerProps {
  onSubmit: (content: string) => Promise<unknown>;
  initialValue?: string;
  submitLabel?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  showAvatar?: boolean;
}

export function CommentComposer({
  onSubmit,
  initialValue = '',
  submitLabel = 'Comment',
  placeholder = 'Share feedback or ask a question…',
  autoFocus,
  onCancel,
  showAvatar = true,
}: CommentComposerProps) {
  const { user } = useAuth();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const content = value.trim();
    if (!content) return;
    setPending(true);
    setError(null);
    try {
      await onSubmit(content);
      setValue('');
    } catch (err) {
      // Keep the text so the user doesn't lose it.
      setError(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex gap-3">
      {showAvatar && user && <UserAvatar user={user} size="sm" className="mt-0.5" />}
      <div className="flex-1 space-y-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          maxLength={MAX}
          rows={value.length > 120 ? 4 : 2}
          autoFocus={autoFocus}
          aria-label={placeholder}
          aria-invalid={!!error}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
          }}
        />
        {error && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          {value.length > MAX * 0.8 && (
            <span className="mr-auto text-xs tabular-nums text-muted-foreground">
              {value.length}/{MAX}
            </span>
          )}
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
          )}
          <Button type="submit" size="sm" disabled={!value.trim()} loading={pending}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
