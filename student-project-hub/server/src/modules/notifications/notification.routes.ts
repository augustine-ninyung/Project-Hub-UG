import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { paginationQuery, uuidParam } from '../../utils/common-schemas.js';
import { paginationMeta, sendSuccess } from '../../utils/response.js';
import * as notificationService from './notification.service.js';

const listQuery = paginationQuery.extend({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unread: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export const notificationRouter = Router();
notificationRouter.use(requireAuth);

notificationRouter.get('/', validate({ query: listQuery }), async (req: Request, res: Response) => {
  const { page, limit, unread } = req.validated.query as z.infer<typeof listQuery>;
  const { items, total, unreadCount } = await notificationService.listNotifications(req.user!.id, {
    page,
    limit,
    unreadOnly: unread,
  });
  res.json({
    success: true,
    data: items,
    meta: { ...paginationMeta(page, limit, total), unreadCount },
  });
});

notificationRouter.get('/unread-count', async (req: Request, res: Response) => {
  sendSuccess(res, { count: await notificationService.unreadCount(req.user!.id) });
});

notificationRouter.delete('/', async (req: Request, res: Response) => {
  sendSuccess(res, { deleted: await notificationService.clearAll(req.user!.id) });
});

// Must be registered before /:id/read so "read-all" is not parsed as an id.
notificationRouter.patch('/read-all', async (req: Request, res: Response) => {
  sendSuccess(res, { updated: await notificationService.markAllRead(req.user!.id) });
});

notificationRouter.patch(
  '/:id/read',
  validate({ params: uuidParam }),
  async (req: Request, res: Response) => {
    const { id } = req.validated.params as { id: string };
    await notificationService.markRead(req.user!.id, id);
    sendSuccess(res, { id, read: true });
  },
);
