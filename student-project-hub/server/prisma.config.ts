import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env itself. Variables that are already set (tests,
// Vercel) take precedence over the file.
try {
  process.loadEnvFile();
} catch {
  // No .env file (CI, Vercel): use the environment as is.
}

/** Migrations and seeding target DATABASE_SCHEMA when set (preview deployments). */
function datasourceUrl() {
  const raw = process.env.DATABASE_URL;
  const schema = process.env.DATABASE_SCHEMA;
  if (!raw || !schema) return raw ?? '';
  const url = new URL(raw);
  url.searchParams.set('schema', schema);
  return url.toString();
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Not needed by `prisma generate`, so a missing value only fails commands
    // that actually connect (migrate, db seed).
    url: datasourceUrl(),
  },
});
