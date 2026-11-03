import type { Response } from 'express';

/**
 * Every successful response has the shape `{ success: true, data, meta? }`.
 * Errors (see error middleware) are `{ success: false, error: { code, message, details? } }`.
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200, meta?: PaginationMeta) {
  return res.status(statusCode).json({ success: true, data, ...(meta ? { meta } : {}) });
}

export function paginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
