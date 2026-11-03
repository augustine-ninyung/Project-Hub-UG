import type { Options } from 'express-rate-limit';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { PostgresRateLimitStore } from '../src/middleware/rate-limit-store.js';

const store = (windowMs: number) => {
  const s = new PostgresRateLimitStore('test:');
  s.init({ windowMs } as Options);
  return s;
};

describe('PostgresRateLimitStore', () => {
  it('counts hits per key within the window', async () => {
    const s = store(60_000);
    expect((await s.increment('a')).totalHits).toBe(1);
    expect((await s.increment('a')).totalHits).toBe(2);
    expect((await s.increment('b')).totalHits).toBe(1);

    const third = await s.increment('a');
    expect(third.totalHits).toBe(3);
    expect(third.resetTime!.getTime()).toBeGreaterThan(Date.now());
  });

  it('shares counts across instances with the same prefix', async () => {
    await store(60_000).increment('shared');
    expect((await store(60_000).increment('shared')).totalHits).toBe(2);
  });

  it('restarts the count once the window has passed', async () => {
    const s = store(60_000);
    await s.increment('expired');
    await s.increment('expired');
    await prisma.rateLimit.update({
      where: { key: 'test:expired' },
      data: { resetAt: new Date(Date.now() - 1000) },
    });
    expect((await s.increment('expired')).totalHits).toBe(1);
  });

  it('decrements and resets keys', async () => {
    const s = store(60_000);
    await s.increment('k');
    await s.increment('k');
    await s.decrement('k');
    expect((await s.increment('k')).totalHits).toBe(2);
    await s.resetKey('k');
    expect((await s.increment('k')).totalHits).toBe(1);
  });

  it('counts concurrent hits without losing any', async () => {
    const s = store(60_000);
    await Promise.all(Array.from({ length: 15 }, () => s.increment('burst')));
    expect((await s.increment('burst')).totalHits).toBe(16);
  });
});
