import { Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { getErrorMessage } from '@/services/api';
import { cn } from '@/utils/cn';
import { compactNumber } from '@/utils/format';
import { useToggleLike } from './hooks';

interface LikeButtonProps {
  projectId: string;
  liked: boolean;
  count: number;
  variant?: 'compact' | 'full';
}

/**
 * Optimistically toggles the like, then reconciles with the server's
 * response (or rolls back and reports the error).
 */
export function LikeButton({ projectId, liked, count, variant = 'full' }: LikeButtonProps) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const mutation = useToggleLike(projectId);
  const [state, setState] = useState({ liked, count });

  useEffect(() => setState({ liked, count }), [liked, count]);

  const toggle = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/projects/${projectId}` } });
      return;
    }
    const previous = state;
    const next = !state.liked;
    setState({ liked: next, count: state.count + (next ? 1 : -1) });
    mutation.mutate(next, {
      onSuccess: (res) => setState({ liked: res.liked, count: res.likeCount }),
      onError: (err) => {
        setState(previous);
        toast.error(getErrorMessage(err));
      },
    });
  };

  const label = state.liked ? 'Unlike project' : 'Like project';

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }}
        disabled={mutation.isPending}
        aria-pressed={state.liked}
        aria-label={`${label} (${state.count} likes)`}
        className={cn(
          'relative z-10 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs tabular-nums transition-colors hover:bg-like/10 hover:text-like',
          state.liked ? 'text-like' : 'text-muted-foreground',
        )}
      >
        <Heart className={cn('size-3.5', state.liked && 'fill-current')} aria-hidden />
        {compactNumber(state.count)}
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={toggle}
      disabled={mutation.isPending}
      aria-pressed={state.liked}
      aria-label={label}
      className={cn(state.liked && 'border-like/40 bg-like/10 text-like hover:bg-like/15 hover:text-like')}
    >
      <Heart className={cn(state.liked && 'fill-current')} aria-hidden />
      <span className="tabular-nums">{compactNumber(state.count)}</span>
      <span className="sr-only">likes</span>
    </Button>
  );
}
