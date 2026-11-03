import type { CookieOptions, Request, Response } from 'express';
import { env, isProduction } from '../../config/env.js';
import { ACCESS_COOKIE } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import * as authService from './auth.service.js';
import type { IssuedSession } from './auth.service.js';

export const REFRESH_COOKIE = 'refresh_token';
const REFRESH_PATH = '/api/v1/auth';

// In production the client reaches the API through a same-origin rewrite on
// Vercel, so Lax first-party cookies work even where third-party cookies are
// blocked. COOKIE_SAME_SITE=none supports a cross-site setup instead.
// CSRF is additionally handled by csrfProtection.
const baseCookie: CookieOptions = {
  httpOnly: true,
  secure: isProduction || env.COOKIE_SAME_SITE === 'none',
  sameSite: env.COOKIE_SAME_SITE,
};

function setSessionCookies(res: Response, session: IssuedSession) {
  res.cookie(ACCESS_COOKIE, session.accessToken, {
    ...baseCookie,
    path: '/',
    maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...baseCookie,
    path: REFRESH_PATH,
    expires: session.refreshExpiresAt,
  });
}

function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookie, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie, path: REFRESH_PATH });
}

const sessionContext = (req: Request) => ({
  userAgent: req.get('user-agent'),
  ipAddress: req.ip,
});

export async function register(req: Request, res: Response) {
  const { user, session } = await authService.register(req.body, sessionContext(req));
  setSessionCookies(res, session);
  sendSuccess(res, { user }, 201);
}

export async function login(req: Request, res: Response) {
  const { user, session } = await authService.login(req.body, sessionContext(req));
  setSessionCookies(res, session);
  sendSuccess(res, { user });
}

export async function refresh(req: Request, res: Response) {
  try {
    const session = await authService.refresh(req.cookies?.[REFRESH_COOKIE], sessionContext(req));
    setSessionCookies(res, session);
    sendSuccess(res, { refreshed: true });
  } catch (err) {
    clearSessionCookies(res);
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  clearSessionCookies(res);
  sendSuccess(res, { loggedOut: true });
}

export async function me(req: Request, res: Response) {
  sendSuccess(res, { user: await authService.getSelf(req.user!.id) });
}

export async function verifyEmail(req: Request, res: Response) {
  sendSuccess(res, { user: await authService.verifyEmail(req.body.token) });
}

export async function resendVerification(req: Request, res: Response) {
  await authService.resendVerification(req.user!.id);
  sendSuccess(res, { message: 'Verification email sent' });
}

export async function forgotPassword(req: Request, res: Response) {
  await authService.forgotPassword(req.body.email);
  sendSuccess(res, {
    message: 'If an account exists for that email, a password reset link has been sent',
  });
}

export async function resetPassword(req: Request, res: Response) {
  await authService.resetPassword(req.body.token, req.body.password);
  clearSessionCookies(res);
  sendSuccess(res, { message: 'Password updated. Please sign in with your new password.' });
}
