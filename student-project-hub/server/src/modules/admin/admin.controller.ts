import type { Request, Response } from 'express';
import { paginationMeta, sendSuccess } from '../../utils/response.js';
import { deleteProject } from '../projects/project.service.js';
import * as adminService from './admin.service.js';
import type { AdminProjectsQuery, AdminReportsQuery, AdminUsersQuery } from './admin.schemas.js';

const idOf = (req: Request) => (req.validated.params as { id: string }).id;

export async function statistics(_req: Request, res: Response) {
  sendSuccess(res, await adminService.getStatistics());
}

export async function activity(_req: Request, res: Response) {
  sendSuccess(res, await adminService.getActivity());
}

export async function users(req: Request, res: Response) {
  const query = req.validated.query as AdminUsersQuery;
  const { items, total } = await adminService.listUsers(query);
  sendSuccess(res, items, 200, paginationMeta(query.page, query.limit, total));
}

export async function updateUser(req: Request, res: Response) {
  sendSuccess(res, await adminService.updateUser(idOf(req), req.user!, req.body));
}

export async function projects(req: Request, res: Response) {
  const query = req.validated.query as AdminProjectsQuery;
  const { items, total } = await adminService.listProjects(query);
  sendSuccess(res, items, 200, paginationMeta(query.page, query.limit, total));
}

export async function featureProject(req: Request, res: Response) {
  sendSuccess(res, await adminService.setFeatured(idOf(req), req.body.isFeatured));
}

export async function removeProject(req: Request, res: Response) {
  await deleteProject(idOf(req), req.user!);
  res.status(204).end();
}

export async function reports(req: Request, res: Response) {
  const query = req.validated.query as AdminReportsQuery;
  const { items, total } = await adminService.listReports(query);
  sendSuccess(res, items, 200, paginationMeta(query.page, query.limit, total));
}

export async function reviewReport(req: Request, res: Response) {
  sendSuccess(res, await adminService.reviewReport(idOf(req), req.user!, req.body));
}

export async function createCategory(req: Request, res: Response) {
  sendSuccess(res, await adminService.createCategory(req.body), 201);
}

export async function updateCategory(req: Request, res: Response) {
  sendSuccess(res, await adminService.updateCategory(idOf(req), req.body));
}

export async function deleteCategory(req: Request, res: Response) {
  await adminService.deleteCategory(idOf(req));
  res.status(204).end();
}
