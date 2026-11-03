import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import { prisma } from '../config/prisma.js';

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
      INSERT INTO "RateLimit" ("key", "hits", "resetAt")
      VALUES (${this.prefix + key}, 1, now() + make_interval(secs => ${seconds}::double precision))
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."hits" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
      RETURNING "hits", "resetAt"`;

    // Occasionally clear expired rows so the table stays small.
    if (Math.random() < 0.01) {
      await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
    }
    return { totalHits: row!.hits, resetTime: row!.resetAt };
  }

  async decrement(key: string) {
    await prisma.$executeRaw`
      UPDATE "RateLimit" SET "hits" = GREATEST("hits" - 1, 0) WHERE "key" = ${this.prefix + key}`;
  }

  async resetKey(key: string) {
    await prisma.rateLimit.deleteMany({ where: { key: this.prefix + key } });
  }
}
