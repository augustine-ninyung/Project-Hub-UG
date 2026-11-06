import { timingSafeEqual } from 'node:crypto';
import { Router, type Request, type RequestHandler, type Response } from 'express';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { runDailyBackup } from '../../services/backup.service.js';
import { ApiError } from '../../utils/api-error.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Scheduled jobs, called by Vercel Cron (see vercel.json). Vercel sends
 * "Authorization: Bearer <CRON_SECRET>"; anything else is refused, and the
 * jobs are switched off entirely when CRON_SECRET isn't set.
 */
export const cronRouter = Router();

const requireCronSecret: RequestHandler = (req, _res, next) => {
  if (!env.CRON_SECRET) throw new ApiError(503, 'Scheduled jobs are not configured', 'CRON_DISABLED');
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const given = Buffer.from(req.get('authorization') ?? '');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw ApiError.unauthorized();
  next();
};

/**
 * Once a day: touch the database (Supabase pauses free projects after a week
 * without activity) and write the daily backup.
 */
cronRouter.get('/daily', requireCronSecret, async (_req: Request, res: Response) => {
  await prisma.$queryRaw`SELECT 1`;
  const backup = await runDailyBackup();
  console.log(`Daily backup ${backup.name}: ${backup.bytes} bytes, removed ${backup.removed.length} old`);
  sendSuccess(res, { keptAlive: true, backup });
});
