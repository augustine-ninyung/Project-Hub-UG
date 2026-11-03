import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env.js';

const common = {
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
  },
};

/** General API limit per IP. */
export const apiLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 1000 });

/** Login / register / password flows: brute-force protection. */
export const authLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 20 });

/**
 * Per-account limit for login and password-reset requests, keyed on the
 * validated email/username so it holds even when client IPs are hidden or
 * rotated. Must run after body validation.
 */
export const accountLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => `account:${String(req.body?.identifier ?? req.body?.email ?? req.ip)}`,
});

/** Writes that trigger notifications or emails (comments, likes, reports, invites). */
export const writeLimiter = rateLimit({ ...common, windowMs: 60 * 1000, limit: 60 });
