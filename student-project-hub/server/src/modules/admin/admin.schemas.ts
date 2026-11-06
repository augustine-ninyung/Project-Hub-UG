import { z } from 'zod';
import { paginationQuery } from '../../utils/common-schemas.js';

export const adminUsersQuery = paginationQuery.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  role: z.enum(['STUDENT', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  verified: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  deletion: z.enum(['requested']).optional(),
});

export const updateUserSchema = z
  .object({
    role: z.enum(['STUDENT', 'ADMIN']).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  })
  .refine((v) => v.role || v.status, 'Nothing to update');

export const adminProjectsQuery = paginationQuery.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  featured: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
});

export const featureProjectSchema = z.object({ isFeatured: z.boolean() });

export const adminReportsQuery = paginationQuery.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'RESOLVED', 'DISMISSED']).optional(),
});

export const reviewReportSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  resolutionNote: z.string().trim().max(500).optional(),
  /** When resolving, also remove the reported project/comment. */
  removeContent: z.boolean().default(false),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).nullable().optional(),
});

export type AdminUsersQuery = z.infer<typeof adminUsersQuery>;
export type AdminProjectsQuery = z.infer<typeof adminProjectsQuery>;
export type AdminReportsQuery = z.infer<typeof adminReportsQuery>;
