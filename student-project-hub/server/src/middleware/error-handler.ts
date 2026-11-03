import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
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

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const apiError = toApiError(err);
  if (apiError.statusCode >= 500) console.error(err);

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
};
