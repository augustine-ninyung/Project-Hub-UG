import { z } from 'zod';
import { optionalUrl, paginationQuery, uniqueCaseInsensitive } from '../../utils/common-schemas.js';

const technologies = z
  .array(z.string().trim().min(1).max(40))
  .min(1, 'Add at least one technology')
  .max(15, 'At most 15 technologies')
  .transform(uniqueCaseInsensitive);

const contributorInvite = z.object({
  username: z.string().trim().toLowerCase().min(3).max(30),
  role: z.string().trim().max(60).optional(),
});

const baseFields = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
  description: z
    .string()
    .trim()
    .min(20, 'Description must be at least 20 characters')
    .max(10_000, 'Description must be at most 10,000 characters'),
  categoryId: z.string().uuid('Select a category'),
  technologies,
  githubUrl: optionalUrl,
  liveUrl: optionalUrl,
  status: z.enum(['PLANNING', 'ONGOING', 'COMPLETED']).default('ONGOING'),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
};

export const createProjectSchema = z.object({
  ...baseFields,
  contributors: z.array(contributorInvite).max(10).default([]),
});

export const updateProjectSchema = z.object({
  title: baseFields.title.optional(),
  description: baseFields.description.optional(),
  categoryId: baseFields.categoryId.optional(),
  technologies: technologies.optional(),
  githubUrl: optionalUrl,
  liveUrl: optionalUrl,
  status: z.enum(['PLANNING', 'ONGOING', 'COMPLETED']).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  removeScreenshotIds: z.array(z.string().uuid()).max(20).default([]),
  removeCover: z.boolean().default(false),
});

export const listProjectsQuery = paginationQuery.extend({
  search: z.string().trim().max(100).optional(),
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  technology: z.string().trim().max(60).optional(),
  sort: z.enum(['newest', 'most_liked', 'most_commented']).default('newest'),
});

export const limitQuery = z.object({
  limit: z.coerce.number().int().min(1).max(24).default(8),
});

export const inviteContributorSchema = contributorInvite;

export const updateContributorSchema = z
  .object({
    status: z.enum(['ACCEPTED', 'DECLINED']).optional(),
    role: z.string().trim().max(60).nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.role !== undefined, 'Nothing to update');

export const contributorParams = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuery>;
