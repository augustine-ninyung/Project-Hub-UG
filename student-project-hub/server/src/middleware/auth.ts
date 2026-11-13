import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/api-error.js';
import type { AuthUser } from '../types/express.js';

export const ACCESS_COOKIE = 'access_token';
const ACTIVITY_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

interface AccessPayload {
  sub: string;
}

/**
 * Resolves the user from the access-token cookie. The user row is loaded on
 * every request so suspensions and role changes take effect immediately.
 */
async function resolveUser(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  let payload: AccessPayload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      approvedAt: true,
      lastActiveAt: true,
      deletionRequestedAt: true,
    },
  });
  // Suspended accounts, accounts waiting to be deleted, and accounts whose
  // email isn't confirmed can't act.
  if (!user || user.status === 'SUSPENDED' || user.deletionRequestedAt || !user.emailVerifiedAt) return null;

  // Throttled "last active" tracking powers the "recently active students" list.
  if (!user.lastActiveAt || Date.now() - user.lastActiveAt.getTime() > ACTIVITY_UPDATE_INTERVAL_MS) {
    prisma.user
      .update({ where: { id: user.id }, data: { lastActiveAt: new Date() } })
      .catch(() => undefined);
  }

  return {
    id: user.id,
    role: user.role,
    status: user.status,
    approved: isApproved(user),
  };
}

/** Attaches req.user when a valid session exists; never rejects. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const user = await resolveUser(req.cookies?.[ACCESS_COOKIE]);
  if (user) req.user = user;
  next();
};

/** Rejects with 401 unless the request carries a valid session. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const user = await resolveUser(req.cookies?.[ACCESS_COOKIE]);
  if (!user) throw ApiError.unauthorized();
  req.user = user;
  next();
};

/** Admins are always approved; students once an admin approves them. */
export const isApproved = (user: { role: Role; approvedAt: Date | null }) =>
  user.role === 'ADMIN' || user.approvedAt !== null;

/** Must run after requireAuth. Uploading, commenting and reporting need an admin's approval. */
export const requireApproved: RequestHandler = (req, _res, next) => {
  if (!req.user?.approved) {
    throw new ApiError(
      403,
      'An admin needs to approve your account first. You will get an email when they do.',
      'ACCOUNT_NOT_APPROVED',
    );
  }
  next();
};

/** Must run after requireAuth. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw ApiError.forbidden();
    next();
  };
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies AccessPayload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL_MINUTES * 60,
  });
}
