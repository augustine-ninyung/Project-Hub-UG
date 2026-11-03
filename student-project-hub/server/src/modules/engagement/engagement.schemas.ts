import { z } from 'zod';
import { paginationQuery } from '../../utils/common-schemas.js';

export const commentContent = z
  .string()
  .trim()
  .min(1, 'Comment cannot be empty')
  .max(2000, 'Comment must be at most 2,000 characters');

export const createCommentSchema = z.object({
  content: commentContent,
  parentId: z.string().uuid().optional(),
});

export const updateCommentSchema = z.object({ content: commentContent });

export const listCommentsQuery = paginationQuery.extend({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
