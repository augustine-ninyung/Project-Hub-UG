import { Flag, MoreHorizontal, Pencil, Reply, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/ui/misc';
import { useAuth } from '@/context/auth-context';
import { ReportDialog } from '@/features/projects/report-dialog';
import { getErrorMessage } from '@/services/api';
import type { CommentNode } from '@/types/api';
import { cn } from '@/utils/cn';
import { formatDate, timeAgo } from '@/utils/format';
import { CommentComposer } from './comment-composer';
import type { useCommentMutations } from './hooks';

const MAX_INDENT_DEPTH = 3;

interface CommentItemProps {
  comment: CommentNode;
  depth?: number;
  mutations: ReturnType<typeof useCommentMutations>;
  canInteract: boolean;
}

export function CommentItem({ comment, depth = 0, mutations, canInteract }: CommentItemProps) {
  const { user, isAdmin } = useAuth();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reporting, setReporting] = useState(false);

  const isAuthor = !!user && comment.author?.id === user.id;
  const canDelete = isAuthor || isAdmin;

  const handleDelete = () =>
    mutations.remove.mutate(comment.id, {
      onSuccess: () => {
        setConfirmDelete(false);
        toast.success('Comment deleted');
      },
      onError: (err) => toast.error(getErrorMessage(err)),
    });

  return (
    <div className={cn(depth > 0 && 'border-l pl-4 sm:pl-5', depth >= MAX_INDENT_DEPTH && 'pl-0 sm:pl-0 border-l-0')}>
      <article className="flex gap-3 py-3" aria-label={`Comment by ${comment.author?.fullName ?? 'deleted user'}`}>
        {comment.author ? (
          <Link to={`/u/${comment.author.username}`} className="shrink-0">
            <UserAvatar user={comment.author} size="sm" />
          </Link>
        ) : (
          <div className="size-8 shrink-0 rounded-full bg-muted" aria-hidden />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
            {comment.author ? (
              <Link to={`/u/${comment.author.username}`} className="font-semibold hover:underline">
                {comment.author.fullName}
              </Link>
            ) : (
              <span className="font-medium text-muted-foreground">Deleted comment</span>
            )}
            {comment.author && (
              <span className="text-xs text-muted-foreground">@{comment.author.username}</span>
            )}
            <time
              dateTime={comment.createdAt}
              title={formatDate(comment.createdAt)}
              className="text-xs text-muted-foreground"
            >
              {timeAgo(comment.createdAt)}
              {comment.isEdited && ' · edited'}
            </time>
          </div>

          {editing ? (
            <div className="mt-2">
              <CommentComposer
                initialValue={comment.content}
                submitLabel="Save"
                autoFocus
                showAvatar={false}
                onCancel={() => setEditing(false)}
                onSubmit={async (content) => {
                  await mutations.edit.mutateAsync({ id: comment.id, content });
                  setEditing(false);
                }}
              />
            </div>
          ) : comment.isDeleted ? (
            <p className="mt-1 text-sm italic text-muted-foreground">This comment was deleted.</p>
          ) : (
            <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed">
              {comment.content}
            </p>
          )}

          {!comment.isDeleted && !editing && (
            <div className="-ml-2 mt-1 flex items-center gap-1">
              {canInteract && (
                <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={() => setReplying((r) => !r)}>
                  <Reply /> Reply
                </Button>
              )}
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="size-7 text-muted-foreground" aria-label="Comment actions">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {isAuthor && (
                      <DropdownMenuItem onSelect={() => setEditing(true)}>
                        <Pencil /> Edit
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    )}
                    {!isAuthor && (
                      <DropdownMenuItem onSelect={() => setReporting(true)}>
                        <Flag /> Report
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}

          {replying && (
            <div className="mt-2">
              <CommentComposer
                placeholder={`Reply to ${comment.author?.fullName ?? 'comment'}…`}
                submitLabel="Reply"
                autoFocus
                showAvatar={false}
                onCancel={() => setReplying(false)}
                onSubmit={async (content) => {
                  await mutations.add.mutateAsync({ content, parentId: comment.id });
                  setReplying(false);
                }}
              />
            </div>
          )}
        </div>
      </article>

      {comment.replies.length > 0 && (
        <div className={cn(depth < MAX_INDENT_DEPTH && 'ml-4 sm:ml-5')}>
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              mutations={mutations}
              canInteract={canInteract}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete comment?"
        description="Your comment will be removed. Replies from others will stay visible."
        confirmLabel="Delete"
        destructive
        loading={mutations.remove.isPending}
        onConfirm={handleDelete}
      />
      {reporting && (
        <ReportDialog
          open={reporting}
          onOpenChange={setReporting}
          targetType="COMMENT"
          targetId={comment.id}
        />
      )}
    </div>
  );
}
