import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { uuidParam } from '../../utils/common-schemas.js';
import * as controller from './admin.controller.js';
import {
  adminProjectsQuery,
  adminReportsQuery,
  adminUsersQuery,
  categorySchema,
  featureProjectSchema,
  reviewReportSchema,
  updateUserSchema,
} from './admin.schemas.js';

export const adminRouter = Router();

// Every admin route is authorised server-side by role.
adminRouter.use(requireAuth, requireRole('ADMIN'));

adminRouter.get('/statistics', controller.statistics);
adminRouter.get('/activity', controller.activity);

adminRouter.get('/users', validate({ query: adminUsersQuery }), controller.users);
adminRouter.patch(
  '/users/:id',
  validate({ params: uuidParam, body: updateUserSchema }),
  controller.updateUser,
);

adminRouter.get('/projects', validate({ query: adminProjectsQuery }), controller.projects);
adminRouter.patch(
  '/projects/:id/feature',
  validate({ params: uuidParam, body: featureProjectSchema }),
  controller.featureProject,
);
adminRouter.delete('/projects/:id', validate({ params: uuidParam }), controller.removeProject);

adminRouter.get('/reports', validate({ query: adminReportsQuery }), controller.reports);
adminRouter.patch(
  '/reports/:id',
  validate({ params: uuidParam, body: reviewReportSchema }),
  controller.reviewReport,
);

adminRouter.post('/categories', validate({ body: categorySchema }), controller.createCategory);
adminRouter.patch(
  '/categories/:id',
  validate({ params: uuidParam, body: categorySchema }),
  controller.updateCategory,
);
adminRouter.delete('/categories/:id', validate({ params: uuidParam }), controller.deleteCategory);
