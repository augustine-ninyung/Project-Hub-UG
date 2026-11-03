import { z } from 'zod';

export const uuidParam = z.object({ id: z.string().uuid('Invalid id') });

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

/** Optional http(s) URL; empty strings are treated as "not provided". */
export const optionalUrl = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z
    .string()
    .trim()
    .url('Must be a valid URL')
    .max(500)
    .refine((v) => /^https?:\/\//i.test(v), 'URL must start with http:// or https://')
    .nullable()
    .optional(),
);

/** Removes case-insensitive duplicates, keeping the first spelling. */
export function uniqueCaseInsensitive(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
