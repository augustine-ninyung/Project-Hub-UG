import { Router } from 'express';
import { adminRouter } from './modules/admin/admin.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { commentRouter } from './modules/engagement/engagement.routes.js';
import { metaRouter } from './modules/meta/meta.routes.js';
import { notificationRouter } from './modules/notifications/notification.routes.js';
import { projectRouter } from './modules/projects/project.routes.js';
import { reportRouter } from './modules/reports/report.routes.js';
import { userRouter } from './modules/users/user.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/projects', projectRouter);
apiRouter.use('/comments', commentRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/reports', reportRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/', metaRouter);
