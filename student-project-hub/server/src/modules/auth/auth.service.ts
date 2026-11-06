import argon2 from 'argon2';
import type { AuthTokenType } from '../../generated/prisma/client.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { signAccessToken } from '../../middleware/auth.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../../services/email.service.js';
import { ApiError } from '../../utils/api-error.js';
import { adminTopic, queueTopic } from '../../services/realtime.service.js';
import { generateToken, hashToken } from '../../utils/tokens.js';
import { toSelfUser } from '../users/user.select.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
/** Parallel tabs may present the same refresh token within this window. */
const REFRESH_REUSE_GRACE_MS = 30 * 1000;

export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id });

async function createSession(userId: string, ctx: SessionContext): Promise<IssuedSession> {
  const refreshToken = generateToken(48);
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.userSession.create({
    data: {
      userId,
      refreshTokenHash: hashToken(refreshToken),
      userAgent: ctx.userAgent?.slice(0, 255),
      ipAddress: ctx.ipAddress,
      expiresAt: refreshExpiresAt,
    },
  });
  return { accessToken: signAccessToken(userId), refreshToken, refreshExpiresAt };
}

async function issueAuthToken(userId: string, type: AuthTokenType, ttlMs: number) {
  // Invalidate earlier unused tokens of the same type so only the latest link works.
  await prisma.authToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });
  const token = generateToken();
  await prisma.authToken.create({
    data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) },
  });
  return token;
}

/** Atomically consumes a single-use token; returns its user id. */
async function consumeAuthToken(token: string, type: AuthTokenType) {
  const record = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
    throw ApiError.badRequest('This link is invalid or has expired');
  }
  const { count } = await prisma.authToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (count === 0) throw ApiError.badRequest('This link is invalid or has expired');
  return record.userId;
}

export async function register(input: RegisterInput, ctx: SessionContext) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
    select: { email: true },
  });
  if (existing) {
    throw ApiError.conflict(
      existing.email === input.email
        ? 'An account with this email already exists'
        : 'This username is already taken',
    );
  }

  const user = await prisma.user.create({
    data: {
      fullName: input.fullName,
      username: input.username,
      email: input.email,
      university: input.university,
      department: input.department,
      passwordHash: await hashPassword(input.password),
      lastActiveAt: new Date(),
    },
  });

  const token = await issueAuthToken(user.id, 'EMAIL_VERIFICATION', VERIFICATION_TTL_MS);
  await sendVerificationEmail(user.email, user.fullName, token);
  queueTopic(adminTopic()); // a new student appears on admin dashboards

  return { user: toSelfUser(user), session: await createSession(user.id, ctx) };
}

export async function login(input: LoginInput, ctx: SessionContext) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: input.identifier }, { username: input.identifier }] },
  });

  // Hash anyway when the user does not exist to keep response timing uniform.
  const valid = user
    ? await argon2.verify(user.passwordHash, input.password)
    : (await argon2.hash(input.password), false);

  if (!user || !valid) throw ApiError.unauthorized('Invalid email/username or password');
  if (user.status === 'SUSPENDED') {
    throw new ApiError(403, 'This account has been suspended', 'ACCOUNT_SUSPENDED');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
  return { user: toSelfUser(user), session: await createSession(user.id, ctx) };
}

/** Rotates a refresh token: revokes the presented one and issues a new session. */
export async function refresh(refreshToken: string | undefined, ctx: SessionContext) {
  if (!refreshToken) throw ApiError.unauthorized('No session');

  const session = await prisma.userSession.findUnique({
    where: { refreshTokenHash: hashToken(refreshToken) },
    include: { user: { select: { status: true } } },
  });
  if (!session) throw ApiError.unauthorized('Session expired');

  if (session.revokedAt) {
    // A rotated token being replayed long after rotation suggests theft:
    // revoke every session for this user.
    if (Date.now() - session.revokedAt.getTime() > REFRESH_REUSE_GRACE_MS) {
      await prisma.userSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    throw ApiError.unauthorized('Session expired');
  }
  if (session.expiresAt < new Date() || session.user.status === 'SUSPENDED') {
    throw ApiError.unauthorized('Session expired');
  }

  const { count } = await prisma.userSession.updateMany({
    where: { id: session.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw ApiError.unauthorized('Session expired');

  return createSession(session.userId, ctx);
}

export async function logout(refreshToken: string | undefined) {
  if (!refreshToken) return;
  await prisma.userSession.updateMany({
    where: { refreshTokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function verifyEmail(token: string) {
  const userId = await consumeAuthToken(token, 'EMAIL_VERIFICATION');
  const user = await prisma.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date() },
  });
  return toSelfUser(user);
}

export async function resendVerification(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.emailVerifiedAt) throw ApiError.badRequest('Email is already verified');
  const token = await issueAuthToken(user.id, 'EMAIL_VERIFICATION', VERIFICATION_TTL_MS);
  await sendVerificationEmail(user.email, user.fullName, token);
}

/** Always succeeds from the caller's perspective to avoid account enumeration. */
export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status === 'SUSPENDED') return;
  const token = await issueAuthToken(user.id, 'PASSWORD_RESET', RESET_TTL_MS);
  await sendPasswordResetEmail(user.email, user.fullName, token);
}

export async function resetPassword(token: string, password: string) {
  const userId = await consumeAuthToken(token, 'PASSWORD_RESET');
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(password) },
    }),
    // Sign out every device after a password change.
    prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

export async function getSelf(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.unauthorized();
  return toSelfUser(user);
}
