import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import { Prisma } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';

// Raw SQL doesn't get Prisma's schema setting, so name it here. The schema is
// validated as a plain identifier in env.ts, so quoting it is safe.
const TABLE = Prisma.raw(env.DATABASE_SCHEMA ? `"${env.DATABASE_SCHEMA}"."RateLimit"` : '"RateLimit"');

/**
 * express-rate-limit store backed by PostgreSQL. Serverless instances do not
 * share memory, so limits that guard against brute force must be counted in
 * the database. Each increment is a single atomic upsert.
 */
export class PostgresRateLimitStore implements Store {
  private windowMs = 60_000;
  readonly localKeys = false;

  constructor(readonly prefix: string) {}

  init(options: Options) {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const seconds = this.windowMs / 1000;
    const [row] = await prisma.$queryRaw<{ hits: number; resetAt: Date }[]>`
      INSERT INTO ${TABLE} AS rl ("key", "hits", "resetAt")
      VALUES (${this.prefix + key}, 1, now() + make_interval(secs => ${seconds}::double precision))
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE WHEN rl."resetAt" <= now() THEN 1 ELSE rl."hits" + 1 END,
        "resetAt" = CASE WHEN rl."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE rl."resetAt" END
      RETURNING "hits", "resetAt"`;

    // Occasionally clear expired rows so the table stays small.
    if (Math.random() < 0.01) {
      await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
    }
    return { totalHits: row!.hits, resetTime: row!.resetAt };
  }

  async decrement(key: string) {
    await prisma.$executeRaw`
      UPDATE ${TABLE} SET "hits" = GREATEST("hits" - 1, 0) WHERE "key" = ${this.prefix + key}`;
  }

  async resetKey(key: string) {
    await prisma.rateLimit.deleteMany({ where: { key: this.prefix + key } });
  }
}
