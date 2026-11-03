import type { Request, Response } from 'express';
import { paginationMeta, sendSuccess } from '../../utils/response.js';
import * as contributorService from './contributor.service.js';
import * as projectService from './project.service.js';
import type { ListProjectsQuery } from './project.schemas.js';

type IdParams = { id: string };
type ContributorParams = { id: string; userId: string };

function uploadedFiles(req: Request): projectService.ProjectFiles {
  const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
  return { cover: files.cover?.[0], screenshots: files.screenshots ?? [] };
}

export async function list(req: Request, res: Response) {
  const query = req.validated.query as ListProjectsQuery;
  const { items, total } = await projectService.listProjects(query, req.user);
  sendSuccess(res, items, 200, paginationMeta(query.page, query.limit, total));
}

export async function trending(req: Request, res: Response) {
  const { limit } = req.validated.query as { limit: number };
  sendSuccess(res, await projectService.trendingProjects(limit, req.user));
}

export async function featured(req: Request, res: Response) {
  const { limit } = req.validated.query as { limit: number };
  sendSuccess(res, await projectService.featuredProjects(limit, req.user));
}

export async function recommended(req: Request, res: Response) {
  const { limit } = req.validated.query as { limit: number };
  sendSuccess(res, await projectService.recommendedProjects(limit, req.user));
}

export async function getById(req: Request, res: Response) {
  const { id } = req.validated.params as IdParams;
  sendSuccess(res, await projectService.getProject(id, req.user));
}

export async function related(req: Request, res: Response) {
  const { id } = req.validated.params as IdParams;
  const { limit } = req.validated.query as { limit: number };
  sendSuccess(res, await projectService.relatedProjects(id, limit, req.user));
}

export async function create(req: Request, res: Response) {
  const project = await projectService.createProject(req.user!, req.body, uploadedFiles(req));
  sendSuccess(res, project, 201);
}

export async function update(req: Request, res: Response) {
  const { id } = req.validated.params as IdParams;
  sendSuccess(res, await projectService.updateProject(id, req.user!, req.body, uploadedFiles(req)));
}

export async function remove(req: Request, res: Response) {
  const { id } = req.validated.params as IdParams;
  await projectService.deleteProject(id, req.user!);
  res.status(204).end();
}

export async function inviteContributor(req: Request, res: Response) {
  const { id } = req.validated.params as IdParams;
  sendSuccess(res, await contributorService.inviteContributor(id, req.user!, req.body), 201);
}

export async function updateContributor(req: Request, res: Response) {
  const { id, userId } = req.validated.params as ContributorParams;
  sendSuccess(res, await contributorService.updateContributor(id, userId, req.user!, req.body));
}

export async function removeContributor(req: Request, res: Response) {
  const { id, userId } = req.validated.params as ContributorParams;
  await contributorService.removeContributor(id, userId, req.user!);
  res.status(204).end();
}
