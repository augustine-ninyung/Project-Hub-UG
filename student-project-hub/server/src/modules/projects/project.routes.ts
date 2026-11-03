import { Router } from 'express';
import { optionalAuth, requireAuth, requireVerified } from '../../middleware/auth.js';
import { multipartJson } from '../../middleware/multipart-json.js';
import { writeLimiter } from '../../middleware/rate-limit.js';
import { imageUpload, MAX_SCREENSHOTS } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { uuidParam } from '../../utils/common-schemas.js';
import { commentRoutesForProject } from '../engagement/engagement.routes.js';
import * as controller from './project.controller.js';
import {
  contributorParams,
  createProjectSchema,
  inviteContributorSchema,
  limitQuery,
  listProjectsQuery,
  updateContributorSchema,
  updateProjectSchema,
} from './project.schemas.js';

export const projectRouter = Router();

const projectImages = imageUpload.fields([
  { name: 'cover', maxCount: 1 },
  { name: 'screenshots', maxCount: MAX_SCREENSHOTS },
]);

// Discovery (static paths before /:id)
projectRouter.get('/', optionalAuth, validate({ query: listProjectsQuery }), controller.list);
projectRouter.get('/search', optionalAuth, validate({ query: listProjectsQuery }), controller.list);
projectRouter.get('/trending', optionalAuth, validate({ query: limitQuery }), controller.trending);
projectRouter.get('/featured', optionalAuth, validate({ query: limitQuery }), controller.featured);
projectRouter.get('/recommended', optionalAuth, validate({ query: limitQuery }), controller.recommended);

// CRUD
projectRouter.post(
  '/',
  requireAuth,
  requireVerified,
  projectImages,
  multipartJson,
  validate({ body: createProjectSchema }),
  controller.create,
);
projectRouter.get('/:id', optionalAuth, validate({ params: uuidParam }), controller.getById);
projectRouter.get(
  '/:id/related',
  optionalAuth,
  validate({ params: uuidParam, query: limitQuery }),
  controller.related,
);
projectRouter.patch(
  '/:id',
  requireAuth,
  projectImages,
  multipartJson,
  validate({ params: uuidParam, body: updateProjectSchema }),
  controller.update,
);
projectRouter.delete('/:id', requireAuth, validate({ params: uuidParam }), controller.remove);

// Contributors
projectRouter.post(
  '/:id/contributors',
  requireAuth,
  requireVerified,
  writeLimiter,
  validate({ params: uuidParam, body: inviteContributorSchema }),
  controller.inviteContributor,
);
projectRouter.patch(
  '/:id/contributors/:userId',
  requireAuth,
  validate({ params: contributorParams, body: updateContributorSchema }),
  controller.updateContributor,
);
projectRouter.delete(
  '/:id/contributors/:userId',
  requireAuth,
  validate({ params: contributorParams }),
  controller.removeContributor,
);

// Likes & comments
projectRouter.use('/:id', commentRoutesForProject);
