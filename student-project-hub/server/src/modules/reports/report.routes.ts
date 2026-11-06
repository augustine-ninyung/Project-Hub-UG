import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { requireAuth, requireVerified } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { adminTopic, queueTopic } from '../../services/realtime.service.js';
import { sendSuccess } from '../../utils/response.js';
import { findVisibleProject } from '../projects/project.access.js';

export const REPORT_REASONS = [
  'SPAM',
  'HARASSMENT',
  'INAPPROPRIATE_CONTENT',
  'PLAGIARISM',
  'MISLEADING',
  'OTHER',
] as const;

const createReportSchema = z.object({
  targetType: z.enum(['PROJECT', 'COMMENT']),
  targetId: z.string().uuid(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional(),
});

export const reportRouter = Router();

reportRouter.post(
  '/',
  requireAuth,
  requireVerified,
  writeLimiter,
  validate({ body: createReportSchema }),
  async (req: Request, res: Response) => {
    const input = req.body as z.infer<typeof createReportSchema>;
    const user = req.user!;

    let projectId: string | undefined;
    let commentId: string | undefined;
    if (input.targetType === 'PROJECT') {
      projectId = (await findVisibleProject(input.targetId, user)).id;
    } else {
      const comment = await prisma.comment.findFirst({
        where: { id: input.targetId, deletedAt: null },
        select: { id: true, projectId: true },
      });
      if (!comment) throw ApiError.notFound('Comment not found');
      await findVisibleProject(comment.projectId, user);
      commentId = comment.id;
    }

    const duplicate = await prisma.report.count({
      where: { reporterId: user.id, projectId, commentId, status: 'PENDING' },
    });
    if (duplicate) throw ApiError.conflict('You have already reported this content');

    const report = await prisma.report.create({
      data: {
        reporterId: user.id,
        targetType: input.targetType,
        projectId,
        commentId,
        reason: input.reason,
        details: input.details,
      },
      select: { id: true, targetType: true, reason: true, status: true, createdAt: true },
    });
    queueTopic(adminTopic());
    sendSuccess(res, report, 201);
  },
);
