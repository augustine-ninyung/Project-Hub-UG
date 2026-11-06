import { Router } from 'express';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import { imageUpload } from '../../middleware/upload.js';
import { authLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { limitQuery } from '../projects/project.schemas.js';
import * as controller from './user.controller.js';
import { deletionRequestSchema, searchUsersQuery, updateProfileSchema, userIdentifierParam } from './user.schemas.js';

export const userRouter = Router();

userRouter.get('/', requireAuth, validate({ query: searchUsersQuery }), controller.search);
userRouter.get('/active', validate({ query: limitQuery }), controller.recentlyActive);

userRouter.get('/me', requireAuth, controller.getMe);
userRouter.patch('/me', requireAuth, validate({ body: updateProfileSchema }), controller.updateMe);
userRouter.post('/me/avatar', requireAuth, imageUpload.single('avatar'), controller.uploadAvatar);
userRouter.delete('/me/avatar', requireAuth, controller.deleteAvatar);
userRouter.get('/me/invitations', requireAuth, controller.myInvitations);
// Password-checked, so rate limited like sign-in.
userRouter.post(
  '/me/deletion-request',
  requireAuth,
  authLimiter,
  validate({ body: deletionRequestSchema }),
  controller.requestDeletion,
);

userRouter.get('/:id', optionalAuth, validate({ params: userIdentifierParam }), controller.getProfile);
