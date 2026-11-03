import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) => v.split(',').map((o) => o.trim()).filter(Boolean)),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:4000'),
  /** Proxies in front of the API: 1 = Render only, 2 = Vercel rewrite + Render. */
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
  /** 'lax' when the client reaches the API on the same site (Vercel rewrite); 'none' if cross-site. */
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  SUPABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  SUPABASE_BUCKET: z.string().default('project-hub'),
  /** Local-disk fallback directory, relative to the server folder. */
  LOCAL_UPLOAD_DIR: z.string().default('uploads'),

  SMTP_HOST: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PASS: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  EMAIL_FROM: z.string().default('Student Project Hub <no-reply@example.com>'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

if (env.NODE_ENV === 'production') {
  const missing = [
    !env.SUPABASE_URL && 'SUPABASE_URL',
    !env.SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
    // Without SMTP, verification and reset emails would only reach the logs.
    !env.SMTP_HOST && 'SMTP_HOST',
    !process.env.EMAIL_FROM && 'EMAIL_FROM',
  ].filter(Boolean);
  if (missing.length) {
    console.error(`Missing required production configuration: ${missing.join(', ')}`);
    process.exit(1);
  }
}

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
