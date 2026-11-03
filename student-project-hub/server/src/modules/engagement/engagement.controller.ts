import type { Request, Response } from 'express';
import { paginationMeta, sendSuccess } from '../../utils/response.js';
import * as engagementService from './engagement.service.js';

type IdParams = { id: string };

export async function like(req: Request, res: Response) {
  const { id } = req.validated.params as IdParams;
  sendSuccess(res, await engagementService.likeProject(id, req.user!));
}

export async function unlike(req: Request, res: Response) {
  const { id } = req.validated.params as IdParams;
  sendSuccess(res, await engagementService.unlikeProject(id, req.user!));
}

export async function listComments(req: Request, res: Response) {
  const { id } = req.validated.params as IdParams;
  const query = req.validated.query as { page: number; limit: number };
  const { items, total } = await engagementService.listComments(id, req.user, query);
  sendSuccess(res, items, 200, paginationMeta(query.page, query.limit, total));
}

export async function createComment(req: Request, res: Response) {
  const { id } = req.validated.params as IdParams;
  sendSuccess(res, await engagementService.createComment(id, req.user!, req.body), 201);
}

export async function updateComment(req: Request, res: Response) {
  const { id } = req.validated.params as IdParams;
  sendSuccess(res, await engagementService.updateComment(id, req.user!, req.body.content));
}

export async function deleteComment(req: Request, res: Response) {
  const { id } = req.validated.params as IdParams;
  await engagementService.deleteComment(id, req.user!);
  res.status(204).end();
}
