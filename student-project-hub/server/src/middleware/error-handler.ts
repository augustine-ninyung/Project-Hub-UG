import type { ErrorRequestHandler, Request, RequestHandler } from 'express';
import { reportErrorWithin } from '../services/admin-alerts.service.js';
import { Prisma } from '../generated/prisma/client.js';
import multer from 'multer';
import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

export const notFoundHandler: RequestHandler = (req) => {
  throw ApiError.notFound(`Route ${req.method} ${req.path} not found`);
};

const MULTER_MESSAGES: Partial<Record<multer.ErrorCode, string>> = {
  LIMIT_FILE_SIZE: 'Each image must be 5 MB or smaller',
  LIMIT_FILE_COUNT: 'Too many files uploaded',
  LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
};

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  if (err instanceof ZodError) {
    return new ApiError(
      422,
      'Validation failed',
      'VALIDATION_ERROR',
      err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }

  if (err instanceof multer.MulterError) {
    return ApiError.badRequest(MULTER_MESSAGES[err.code] ?? err.message);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return ApiError.conflict('A record with these details already exists');
    if (err.code === 'P2025') return ApiError.notFound();
    if (err.code === 'P2003') return ApiError.conflict('This record is referenced by other data');
  }

  // Malformed JSON body from express.json()
  if (err instanceof SyntaxError && 'body' in err) {
    return ApiError.badRequest('Malformed JSON body');
  }

  return new ApiError(500, 'Internal server error', 'INTERNAL_ERROR');
}

/** "POST /api/v1/projects/:id/like": the route, without ids or query strings. */
export function describeRequest(req: Request) {
  const path = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
  return `${req.method} ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id')}`;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const apiError = toApiError(err);
  const respond = () =>
    res.status(apiError.statusCode).json({
      success: false,
      error: {
        code: apiError.code,
        message: apiError.message,
        ...(apiError.details !== undefined ? { details: apiError.details } : {}),
        ...(!isProduction && apiError.statusCode >= 500 && err instanceof Error
          ? { stack: err.stack }
          : {}),
      },
    });

  if (apiError.statusCode < 500) return respond();
  console.error(err);
  // Serverless functions stop after responding, so the alert goes out first.
  void reportErrorWithin(err, describeRequest(req)).finally(respond);
};
