import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import type { AuthUser } from '../../types/express.js';
import { ApiError } from '../../utils/api-error.js';
import { notify } from '../notifications/notification.service.js';
import { findVisibleProject } from '../projects/project.access.js';
import { userSummarySelect } from '../users/user.select.js';

// ─── Likes ─────────────────────────────────────────────────────────────

/** Idempotent: liking twice is a no-op thanks to the (userId, projectId) unique key. */
export async function likeProject(projectId: string, user: AuthUser) {
  const project = await findVisibleProject(projectId, user);

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.like.create({ data: { userId: user.id, projectId } });
      const { likeCount } = await tx.project.update({
        where: { id: projectId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });

      // Avoid notification spam from repeated like/unlike toggling.
      const alreadyNotified = await tx.notification.count({
        where: {
          type: 'PROJECT_LIKED',
          recipientId: project.ownerId,
          actorId: user.id,
          projectId,
          readAt: null,
        },
      });
      if (!alreadyNotified) {
        await notify(tx, {
          type: 'PROJECT_LIKED',
          recipientId: project.ownerId,
          actorId: user.id,
          projectId,
          message: `liked your project "${project.title}"`,
        });
      }
      return { liked: true, likeCount };
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const { likeCount } = await prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { likeCount: true },
      });
      return { liked: true, likeCount };
    }
    throw err;
  }
}

export async function unlikeProject(projectId: string, user: AuthUser) {
  await findVisibleProject(projectId, user);
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.like.deleteMany({ where: { userId: user.id, projectId } });
    const { likeCount } = count
      ? await tx.project.update({
          where: { id: projectId },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        })
      : await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { likeCount: true } });
    return { liked: false, likeCount };
  });
}

// ─── Comments ──────────────────────────────────────────────────────────

const commentSelect = {
  id: true,
  content: true,
  parentId: true,
  rootId: true,
  editedAt: true,
  deletedAt: true,
  createdAt: true,
  author: { select: userSummarySelect },
} satisfies Prisma.CommentSelect;

type CommentRow = Prisma.CommentGetPayload<{ select: typeof commentSelect }>;

export interface CommentNode {
  id: string;
  content: string;
  parentId: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  author: CommentRow['author'] | null;
  replies: CommentNode[];
}

function toNode(row: CommentRow): CommentNode {
  const deleted = row.deletedAt !== null;
  return {
    id: row.id,
    content: deleted ? '' : row.content,
    parentId: row.parentId,
    isEdited: row.editedAt !== null,
    isDeleted: deleted,
    createdAt: row.createdAt,
    author: deleted ? null : row.author,
    replies: [],
  };
}

/** Top-level comments (newest first, paginated) with their full reply trees. */
export async function listComments(
  projectId: string,
  viewer: AuthUser | undefined,
  { page, limit }: { page: number; limit: number },
) {
  await findVisibleProject(projectId, viewer);

  const where = { projectId, parentId: null };
  const [roots, total] = await prisma.$transaction([
    prisma.comment.findMany({
      where,
      select: commentSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.comment.count({ where }),
  ]);

  const replies = roots.length
    ? await prisma.comment.findMany({
        where: { rootId: { in: roots.map((r) => r.id) } },
        select: commentSelect,
        orderBy: { createdAt: 'asc' },
      })
    : [];

  const nodes = new Map<string, CommentNode>();
  for (const row of [...roots, ...replies]) nodes.set(row.id, toNode(row));
  for (const reply of replies) {
    nodes.get(reply.parentId!)?.replies.push(nodes.get(reply.id)!);
  }

  return { items: roots.map((r) => nodes.get(r.id)!), total };
}

export async function createComment(
  projectId: string,
  user: AuthUser,
  input: { content: string; parentId?: string },
) {
  const project = await findVisibleProject(projectId, user);

  let parent: { id: string; rootId: string | null; authorId: string } | null = null;
  if (input.parentId) {
    parent = await prisma.comment.findFirst({
      where: { id: input.parentId, projectId, deletedAt: null },
      select: { id: true, rootId: true, authorId: true },
    });
    if (!parent) throw ApiError.badRequest('The comment you are replying to no longer exists');
  }

  return prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: {
        content: input.content,
        projectId,
        authorId: user.id,
        parentId: parent?.id,
        rootId: parent ? (parent.rootId ?? parent.id) : null,
      },
      select: commentSelect,
    });
    await tx.project.update({
      where: { id: projectId },
      data: { commentCount: { increment: 1 } },
    });

    const notifications = [];
    if (parent) {
      notifications.push({
        type: 'COMMENT_REPLIED' as const,
        recipientId: parent.authorId,
        actorId: user.id,
        projectId,
        commentId: comment.id,
        message: `replied to your comment on "${project.title}"`,
      });
    }
    // The owner gets a "commented" notification unless already notified as the parent author.
    if (!parent || parent.authorId !== project.ownerId) {
      notifications.push({
        type: 'PROJECT_COMMENTED' as const,
        recipientId: project.ownerId,
        actorId: user.id,
        projectId,
        commentId: comment.id,
        message: `commented on your project "${project.title}"`,
      });
    }
    await notify(tx, notifications);

    return toNode(comment);
  });
}

async function findOwnComment(commentId: string, user: AuthUser, allowModerators: boolean) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, projectId: true, deletedAt: true },
  });
  if (!comment || comment.deletedAt) throw ApiError.notFound('Comment not found');
  const isModerator = allowModerators && user.role === 'ADMIN';
  if (comment.authorId !== user.id && !isModerator) {
    throw ApiError.forbidden('You can only modify your own comments');
  }
  return comment;
}

export async function updateComment(commentId: string, user: AuthUser, content: string) {
  await findOwnComment(commentId, user, false);
  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { content, editedAt: new Date() },
    select: commentSelect,
  });
  return toNode(updated);
}

/** Soft delete keeps the thread structure intact for replies. */
export async function deleteComment(commentId: string, user: AuthUser) {
  const comment = await findOwnComment(commentId, user, true);
  await prisma.$transaction([
    prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date(), content: '' },
    }),
    prisma.project.update({
      where: { id: comment.projectId },
      data: { commentCount: { decrement: 1 } },
    }),
  ]);
}
