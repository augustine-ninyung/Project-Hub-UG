import type { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { queueTopic, userTopic } from '../../services/realtime.service.js';
import { ApiError } from '../../utils/api-error.js';
import { userSummarySelect } from '../users/user.select.js';

type Db = Prisma.TransactionClient | typeof prisma;

export interface NotifyInput {
  type: NotificationType;
  recipientId: string;
  actorId: string;
  message: string;
  projectId?: string;
  commentId?: string;
}

/** Creates notifications, skipping any addressed to the actor themself. */
export async function notify(db: Db, inputs: NotifyInput | NotifyInput[]) {
  const list = (Array.isArray(inputs) ? inputs : [inputs]).filter(
    (n) => n.recipientId !== n.actorId,
  );
  if (list.length === 0) return;
  await db.notification.createMany({ data: list });
  for (const n of list) queueTopic(userTopic(n.recipientId));
}

const notificationInclude = {
  actor: { select: userSummarySelect },
  project: { select: { id: true, title: true, coverImageUrl: true } },
} satisfies Prisma.NotificationInclude;

export async function listNotifications(
  userId: string,
  { page, limit, unreadOnly }: { page: number; limit: number; unreadOnly: boolean },
) {
  const where: Prisma.NotificationWhereInput = {
    recipientId: userId,
    ...(unreadOnly ? { readAt: null } : {}),
  };
  const [items, total, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      include: notificationInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { recipientId: userId, readAt: null } }),
  ]);
  return { items, total, unreadCount };
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { recipientId: userId, readAt: null } });
}

export async function markRead(userId: string, id: string) {
  const { count } = await prisma.notification.updateMany({
    where: { id, recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (count === 0) {
    const exists = await prisma.notification.count({ where: { id, recipientId: userId } });
    if (!exists) throw ApiError.notFound('Notification not found');
  }
}

export async function markAllRead(userId: string) {
  const { count } = await prisma.notification.updateMany({
    where: { recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  return count;
}
