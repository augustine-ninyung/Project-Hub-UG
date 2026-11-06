import { z } from 'zod';

export const deletionRequestSchema = z.object({
  password: z.string().min(1, 'Enter your password to confirm').max(128),
  reason: z.string().trim().max(500).optional(),
});
import { optionalUrl, uniqueCaseInsensitive } from '../../utils/common-schemas.js';
import { usernameSchema } from '../auth/auth.schemas.js';

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  username: usernameSchema.optional(),
  university: z.string().trim().min(2).max(150).optional(),
  department: z.string().trim().min(2).max(150).optional(),
  bio: z.string().trim().max(1000).nullable().optional(),
  skills: z
    .array(z.string().trim().min(1).max(40))
    .max(30, 'At most 30 skills')
    .transform(uniqueCaseInsensitive)
    .optional(),
  githubUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  portfolioUrl: optionalUrl,
});

export const userIdentifierParam = z.object({
  // Accepts a UUID or a username.
  id: z.string().trim().min(1).max(64),
});

export const searchUsersQuery = z.object({
  search: z.string().trim().min(1).max(50),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
