import { Router } from 'express';
import { optionalAuth, requireAuth, requireVerified } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { uuidParam } from '../../utils/common-schemas.js';
import * as controller from './engagement.controller.js';
import { createCommentSchema, listCommentsQuery, updateCommentSchema } from './engagement.schemas.js';

/** Mounted under /projects/:id */
export const commentRoutesForProject = Router({ mergeParams: true });

commentRoutesForProject.post(
  '/like',
  requireAuth,
  writeLimiter,
  validate({ params: uuidParam }),
  controller.like,
);
commentRoutesForProject.delete(
  '/like',
  requireAuth,
  writeLimiter,
  validate({ params: uuidParam }),
  controller.unlike,
);
commentRoutesForProject.get(
  '/comments',
  optionalAuth,
  validate({ params: uuidParam, query: listCommentsQuery }),
  controller.listComments,
);
commentRoutesForProject.post(
  '/comments',
  requireAuth,
  requireVerified,
  writeLimiter,
  validate({ params: uuidParam, body: createCommentSchema }),
  controller.createComment,
);

/** Mounted at /comments */
export const commentRouter = Router();

commentRouter.patch(
  '/:id',
  requireAuth,
  validate({ params: uuidParam, body: updateCommentSchema }),
  controller.updateComment,
);
commentRouter.delete('/:id', requireAuth, validate({ params: uuidParam }), controller.deleteComment);
