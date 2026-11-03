import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { validate } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/response.js';

/** Read-only reference data used by filters and forms. */
export const metaRouter = Router();

metaRouter.get('/categories', async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      _count: { select: { projects: { where: { visibility: 'PUBLIC' } } } },
    },
  });
  res.set('Cache-Control', 'public, max-age=60');
  sendSuccess(
    res,
    categories.map(({ _count, ...c }) => ({ ...c, projectCount: _count.projects })),
  );
});

const technologiesQuery = z.object({
  search: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

metaRouter.get(
  '/technologies',
  validate({ query: technologiesQuery }),
  async (req: Request, res: Response) => {
    const { search, limit } = req.validated.query as z.infer<typeof technologiesQuery>;
    const technologies = await prisma.technology.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      select: { id: true, name: true, slug: true, _count: { select: { projects: true } } },
      orderBy: [{ projects: { _count: 'desc' } }, { name: 'asc' }],
      take: limit,
    });
    res.set('Cache-Control', 'public, max-age=60');
    sendSuccess(
      res,
      technologies.map(({ _count, ...t }) => ({ ...t, projectCount: _count.projects })),
    );
  },
);
