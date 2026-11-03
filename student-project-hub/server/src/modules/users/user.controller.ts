import type { Request, Response } from 'express';
import { ApiError } from '../../utils/api-error.js';
import { sendSuccess } from '../../utils/response.js';
import { getSelf } from '../auth/auth.service.js';
import { listInvitations } from '../projects/contributor.service.js';
import * as userService from './user.service.js';

export async function getMe(req: Request, res: Response) {
  sendSuccess(res, { user: await getSelf(req.user!.id) });
}

export async function updateMe(req: Request, res: Response) {
  sendSuccess(res, { user: await userService.updateProfile(req.user!.id, req.body) });
}

export async function uploadAvatar(req: Request, res: Response) {
  if (!req.file) throw ApiError.badRequest('Attach an image in the "avatar" field');
  sendSuccess(res, { user: await userService.updateAvatar(req.user!.id, req.file) });
}

export async function deleteAvatar(req: Request, res: Response) {
  sendSuccess(res, { user: await userService.removeAvatar(req.user!.id) });
}

export async function myInvitations(req: Request, res: Response) {
  sendSuccess(res, await listInvitations(req.user!.id));
}

export async function getProfile(req: Request, res: Response) {
  const { id } = req.validated.params as { id: string };
  sendSuccess(res, await userService.getProfile(id, req.user));
}

export async function search(req: Request, res: Response) {
  const { search, limit } = req.validated.query as { search: string; limit: number };
  sendSuccess(res, await userService.searchUsers(search, limit, req.user!.id));
}

export async function recentlyActive(req: Request, res: Response) {
  const { limit } = req.validated.query as { limit: number };
  sendSuccess(res, await userService.recentlyActive(limit));
}
