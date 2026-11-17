import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { isTest } from '../../config/env.js';
import { PostgresRateLimitStore } from '../../middleware/rate-limit-store.js';
import { validate } from '../../middleware/validate.js';
import { reportError } from '../../services/admin-alerts.service.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * The website reports its own crashes here (the "Something went wrong" page),
 * so admins hear about them like server errors. Anyone can call it, so it is
 * tightly limited per visitor, and alerts are grouped and capped as usual.
 */
export const clientErrorRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => isTest,
  store: new PostgresRateLimitStore('client-error:'),
  // Over the limit: quietly accept, there's nothing for the page to do.
  handler: (_req, res) => {
    res.status(202).json({ success: true, data: { received: true } });
  },
});

const clientErrorSchema = z.object({
  message: z.string().trim().min(1).max(500),
  stack: z.string().max(4000).optional(),
  /** Page path only; anything after "?" or "#" (like reset tokens) is dropped. */
  path: z
    .string()
    .max(300)
    .transform((p) => p.split(/[?#]/)[0]!),
});

clientErrorRouter.post('/', limiter, validate({ body: clientErrorSchema }), async (req: Request, res: Response) => {
  const { message, stack, path } = req.body as z.infer<typeof clientErrorSchema>;
  const error = Object.assign(new Error(message), { name: 'WebsiteError', stack: stack ?? '' });
  await reportError(error, `Website page ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id')}`);
  sendSuccess(res, { received: true }, 202);
});
