import type { RequestHandler } from 'express';
import { ApiError } from '../utils/api-error.js';

/**
 * Multipart forms send structured fields as a single JSON string in `data`
 * (alongside the files). This unpacks it into req.body for Zod validation.
 */
export const multipartJson: RequestHandler = (req, _res, next) => {
  if (typeof req.body?.data === 'string') {
    try {
      req.body = JSON.parse(req.body.data);
    } catch {
      throw ApiError.badRequest('Field "data" must be valid JSON');
    }
  }
  next();
};
