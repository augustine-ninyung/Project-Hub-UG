import { createHash } from 'node:crypto';
import type { Options } from 'express-rate-limit';
import type { Prisma } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { PostgresRateLimitStore } from '../middleware/rate-limit-store.js';
import { sendApprovalQueueEmail, sendErrorAlertEmail } from './email.service.js';

/** Students who confirmed their email and are waiting for an admin to approve them. */
export const AWAITING_APPROVAL = {
  role: 'STUDENT',
  status: 'ACTIVE',
  emailVerifiedAt: { not: null },
  approvedAt: null,
  deletionRequestedAt: null,
} satisfies Prisma.UserWhereInput;

/** Email addresses of every working admin account. */
export async function adminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE', emailVerifiedAt: { not: null }, deletionRequestedAt: null },
    select: { email: true },
  });
  return admins.map((a) => a.email);
}

async function approvalQueue() {
  const [students, total] = await prisma.$transaction([
    prisma.user.findMany({
      where: AWAITING_APPROVAL,
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: { id: true, fullName: true, username: true, university: true },
    }),
    prisma.user.count({ where: AWAITING_APPROVAL }),
  ]);
  return { students, total };
}

/**
 * Called when a student confirms their email. Admins get an email only when
 * the queue was empty before, so a busy day means one email rather than one
 * per student; the daily reminder covers anyone who joins the queue later.
 */
export async function notifyAdminsOfNewWaitingStudent(userId: string) {
  try {
    const { students, total } = await approvalQueue();
    if (total !== 1 || students[0]?.id !== userId) return;
    await sendApprovalQueueEmail(await adminEmails(), students, total);
  } catch (err) {
    // Never block the student's confirmation over an admin email.
    console.error('Approval notice failed:', err);
  }
}

/** Daily: remind admins of everyone still waiting. Returns how many are waiting. */
export async function sendApprovalReminder() {
  const { students, total } = await approvalQueue();
  if (total > 0) await sendApprovalQueueEmail(await adminEmails(), students, total);
  return total;
}

// ── Error alerts ─────────────────────────────────────────────────────

const HOUR_MS = 60 * 60 * 1000;
/** Most alert emails sent per hour in total, whatever happens. */
export const MAX_ALERTS_PER_HOUR = 10;

function hourlyStore(prefix: string) {
  const store = new PostgresRateLimitStore(prefix);
  store.init({ windowMs: HOUR_MS } as Options);
  return store;
}
const perKind = hourlyStore('alert:kind:');
const overall = hourlyStore('alert:all:');

// Used when the database itself is the problem; per serverless instance.
const memory = new Map<string, { hits: number; resetAt: number }>();
function memoryHit(key: string) {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { hits: 1, resetAt: now + HOUR_MS });
    return 1;
  }
  entry.hits += 1;
  return entry.hits;
}

async function hits(store: PostgresRateLimitStore, key: string) {
  try {
    return (await store.increment(key)).totalHits;
  } catch {
    return memoryHit(store.prefix + key);
  }
}

/** Groups errors that are "the same problem": numbers and ids don't count. */
function fingerprint(where: string, err: Error) {
  const message = err.message.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id').replace(/\d+/g, '#');
  return createHash('sha256').update(`${where}|${err.name}|${message}`).digest('hex').slice(0, 32);
}

async function alertRecipients() {
  const extra = env.ALERT_EMAIL;
  try {
    return [...new Set([...(await adminEmails()), ...extra])];
  } catch {
    return extra; // the database is down: only the configured address can be reached
  }
}

/**
 * Emails admins about an unexpected error on the live site: at most once an
 * hour per kind of error, and never more than MAX_ALERTS_PER_HOUR in total.
 * Never throws.
 */
export async function reportError(err: unknown, where: string) {
  try {
    const error = err instanceof Error ? err : new Error(String(err));
    if ((await hits(perKind, fingerprint(where, error))) !== 1) return;
    if ((await hits(overall, 'all')) > MAX_ALERTS_PER_HOUR) return;
    await sendErrorAlertEmail(await alertRecipients(), {
      where,
      message: error.message || error.name,
      stack: error.stack,
      at: new Date(),
    });
  } catch (alertErr) {
    console.error('Error alert failed:', alertErr);
  }
}

/** Waits for the alert, but never longer than `ms`, so error responses stay quick. */
export function reportErrorWithin(err: unknown, where: string, ms = 4000) {
  return Promise.race([reportError(err, where), new Promise<void>((r) => setTimeout(r, ms).unref?.())]);
}
