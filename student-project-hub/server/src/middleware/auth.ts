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
    select: { id: true, role: true, status: true, emailVerifiedAt: true, lastActiveAt: true, deletionRequestedAt: true },
  });
  // Suspended accounts and accounts waiting to be deleted can't act.
  if (!user || user.status === 'SUSPENDED' || user.deletionRequestedAt) return null;

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
    emailVerified: user.emailVerifiedAt !== null,
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

/** Must run after requireAuth. Content creation requires a verified email. */
export const requireVerified: RequestHandler = (req, _res, next) => {
  if (!req.user?.emailVerified) {
    throw new ApiError(403, 'Please verify your email address first', 'EMAIL_NOT_VERIFIED');
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
