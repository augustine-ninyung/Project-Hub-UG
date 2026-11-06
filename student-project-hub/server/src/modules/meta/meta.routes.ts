import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
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

/**
 * Settings for live updates. The anon key is public by design: it only lets
 * browsers listen for "changed" pings, which carry no data.
 */
metaRouter.get('/realtime', (_req: Request, res: Response) => {
  const enabled = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY);
  res.set('Cache-Control', 'public, max-age=300');
  sendSuccess(res, enabled ? { url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY } : null);
});

/** Public community totals for the landing page; only public content is counted. */
metaRouter.get('/stats', async (_req: Request, res: Response) => {
  const [projects, students, universities, likes] = await Promise.all([
    prisma.project.count({ where: { visibility: 'PUBLIC' } }),
    prisma.user.count({ where: { role: 'STUDENT', status: 'ACTIVE', deletionRequestedAt: null } }),
    prisma.user.findMany({
      where: { status: 'ACTIVE', deletionRequestedAt: null },
      distinct: ['university'],
      select: { university: true },
    }),
    prisma.like.count({ where: { project: { visibility: 'PUBLIC' } } }),
  ]);
  res.set('Cache-Control', 'public, max-age=60');
  sendSuccess(res, { projects, students, universities: universities.length, likes });
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
