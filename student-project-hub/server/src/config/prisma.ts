import { PrismaPg } from '@prisma/adapter-pg';
import type { PoolConfig } from 'pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env, isProduction } from './env.js';

/**
 * node-postgres pool settings from DATABASE_URL. Prisma-specific query
 * parameters from older setups are translated: connection_limit becomes the
 * pool size, pgbouncer is dropped (node-postgres doesn't use named prepared
 * statements, so Supabase's transaction pooler works as is).
 */
export function poolConfig(databaseUrl: string): PoolConfig {
  const url = new URL(databaseUrl);
  const limit = Number(url.searchParams.get('connection_limit')) || undefined;
  url.searchParams.delete('connection_limit');
  url.searchParams.delete('pgbouncer');

  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
  const explicitSsl = url.searchParams.has('sslmode') || url.searchParams.has('ssl');
  return {
    connectionString: url.toString(),
    max: limit,
    // Remote hosts get an encrypted connection, as Prisma's engine used by
    // default (sslmode=prefer, which also did not verify the certificate).
    ssl: !local && !explicitSsl ? { rejectUnauthorized: false } : undefined,
  };
}

// Reuse a single client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Query errors are not logged here: expected ones (e.g. unique conflicts) are
// handled by services, and unexpected ones are logged by the error handler.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(
      poolConfig(env.DATABASE_URL),
      env.DATABASE_SCHEMA ? { schema: env.DATABASE_SCHEMA } : undefined,
    ),
    log: ['warn'],
  });

if (!isProduction) globalForPrisma.prisma = prisma;
