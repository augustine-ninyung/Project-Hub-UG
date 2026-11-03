import type { RequestHandler } from 'express';
import { ApiError } from '../utils/api-error.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie-authenticated requests. State-changing requests must
 * carry a custom header. Browsers only send custom headers cross-origin after a
 * CORS preflight, which the CORS allowlist rejects for untrusted origins, so a
 * forged form post or <img> request from another site cannot pass this check.
 */
export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    throw new ApiError(403, 'Missing or invalid CSRF header', 'CSRF_REJECTED');
  }
  next();
};
