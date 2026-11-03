import { MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { useAuth } from '@/context/auth-context';
import { CommentComposer } from './comment-composer';
import { CommentItem } from './comment-item';
import { useCommentMutations, useComments } from './hooks';

export function CommentSection({ projectId, count }: { projectId: string; count: number }) {
  const { user, isAuthenticated } = useAuth();
  const query = useComments(projectId);
  const mutations = useCommentMutations(projectId);
  const canInteract = isAuthenticated && !!user?.emailVerified;
  const comments = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section id="comments" aria-labelledby="comments-heading" className="scroll-mt-20 space-y-4">
      <h2 id="comments-heading" className="text-lg font-semibold">
        Comments <span className="text-muted-foreground">({count})</span>
      </h2>

      {canInteract ? (
        <CommentComposer onSubmit={(content) => mutations.add.mutateAsync({ content })} />
      ) : (
        <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          {isAuthenticated ? (
            'Verify your email address to join the conversation.'
          ) : (
            <>
              <Link to="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>{' '}
              to leave a comment.
            </>
          )}
        </div>
      )}

      {query.isLoading ? (
        <div className="space-y-4 py-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/4" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} title="Could not load comments" />
      ) : comments.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No comments yet"
          description="Be the first to share feedback on this project."
          className="py-10"
        />
      ) : (
        <div className="divide-y">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} mutations={mutations} canInteract={canInteract} />
          ))}
        </div>
      )}

      {query.hasNextPage && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => query.fetchNextPage()}
          loading={query.isFetchingNextPage}
        >
          Load more comments
        </Button>
      )}
    </section>
  );
}
