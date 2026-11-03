import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validates request parts with Zod. Parsed body replaces `req.body`; parsed
 * query/params are exposed on `req.validated` (Express 5 makes req.query
 * read-only). ZodErrors propagate to the error handler as 422 responses.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    req.validated ??= {};
    if (schemas.params) req.validated.params = schemas.params.parse(req.params);
    if (schemas.query) req.validated.query = schemas.query.parse(req.query);
    if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
    next();
  };
}
