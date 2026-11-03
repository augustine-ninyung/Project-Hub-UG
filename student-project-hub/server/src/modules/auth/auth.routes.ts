import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './auth.controller.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.schemas.js';

export const authRouter = Router();

authRouter.post('/register', authLimiter, validate({ body: registerSchema }), controller.register);
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), controller.login);
authRouter.post('/refresh', controller.refresh);
authRouter.post('/logout', controller.logout);
authRouter.get('/me', requireAuth, controller.me);
authRouter.post('/verify-email', authLimiter, validate({ body: verifyEmailSchema }), controller.verifyEmail);
authRouter.post('/resend-verification', authLimiter, requireAuth, controller.resendVerification);
authRouter.post(
  '/forgot-password',
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  controller.forgotPassword,
);
authRouter.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  controller.resetPassword,
);
