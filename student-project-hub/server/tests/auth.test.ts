import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { generateToken, hashToken } from '../src/utils/tokens.js';
import { app, client, signUp } from './helpers.js';

const validRegistration = {
  fullName: 'Ama Mensah',
  username: 'ama_codes',
  email: 'ama@example.edu',
  password: 'Password123',
  university: 'University of Ghana',
  department: 'Computer Science',
};

describe('POST /auth/register', () => {
  it('creates an account, hashes the password and starts a session', async () => {
    const agent = client();
    const res = await agent.post('/api/v1/auth/register').send(validRegistration);

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ username: 'ama_codes', emailVerified: false });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(String(res.headers['set-cookie'])).toMatch(/access_token=.*HttpOnly/);

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'ama@example.edu' } });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('ama@example.edu');
  });

  it('rejects invalid input with field-level errors', async () => {
    const res = await client()
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(422);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('rejects duplicate email and username', async () => {
    await client().post('/api/v1/auth/register').send(validRegistration);
    const dupEmail = await client()
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, username: 'other' });
    expect(dupEmail.status).toBe(409);
    const dupUsername = await client()
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, email: 'other@example.edu' });
    expect(dupUsername.status).toBe(409);
  });

  it('issues an email verification token', async () => {
    await client().post('/api/v1/auth/register').send(validRegistration);
    const tokens = await prisma.authToken.findMany({ where: { type: 'EMAIL_VERIFICATION' } });
    expect(tokens).toHaveLength(1);
  });
});

describe('POST /auth/login', () => {
  it('logs in with email or username', async () => {
    await client().post('/api/v1/auth/register').send(validRegistration);

    const byEmail = await client()
      .post('/api/v1/auth/login')
      .send({ identifier: 'AMA@example.edu', password: 'Password123' });
    expect(byEmail.status).toBe(200);

    const byUsername = await client()
      .post('/api/v1/auth/login')
      .send({ identifier: 'ama_codes', password: 'Password123' });
    expect(byUsername.status).toBe(200);
  });

  it('rejects wrong credentials with a generic message', async () => {
    await client().post('/api/v1/auth/register').send(validRegistration);
    const wrongPassword = await client()
      .post('/api/v1/auth/login')
      .send({ identifier: 'ama_codes', password: 'WrongPass1' });
    const unknownUser = await client()
      .post('/api/v1/auth/login')
      .send({ identifier: 'nobody', password: 'WrongPass1' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownUser.body.error.message);
  });

  it('blocks suspended accounts', async () => {
    const { user } = await signUp();
    await prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
    const res = await client()
      .post('/api/v1/auth/login')
      .send({ identifier: user.username, password: 'Password123' });
    expect(res.status).toBe(403);
  });
});

describe('sessions', () => {
  it('requires authentication for /auth/me', async () => {
    const res = await client().get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('rotates refresh tokens and rejects the old one', async () => {
    const { agent } = await signUp();
    const before = await prisma.userSession.findMany();
    expect(before).toHaveLength(1);

    const refreshed = await agent.post('/api/v1/auth/refresh');
    expect(refreshed.status).toBe(200);

    const sessions = await prisma.userSession.findMany({ orderBy: { createdAt: 'asc' } });
    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.revokedAt).not.toBeNull();
    expect(sessions[1]!.revokedAt).toBeNull();
  });

  it('logs out by revoking the session and clearing cookies', async () => {
    const { agent } = await signUp();
    const res = await agent.post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    const active = await prisma.userSession.count({ where: { revokedAt: null } });
    expect(active).toBe(0);
  });

  it('rejects state-changing requests without the CSRF header', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'x', password: 'y' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_REJECTED');
  });
});

describe('email verification', () => {
  it('verifies the email with a valid token, only once', async () => {
    const { user } = await signUp({ verified: false });
    const token = generateToken();
    await prisma.authToken.create({
      data: {
        userId: user.id,
        type: 'EMAIL_VERIFICATION',
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const ok = await client().post('/api/v1/auth/verify-email').send({ token });
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.emailVerified).toBe(true);

    const reused = await client().post('/api/v1/auth/verify-email').send({ token });
    expect(reused.status).toBe(400);
  });
});

describe('password reset', () => {
  it('responds identically for known and unknown emails', async () => {
    const { user } = await signUp();
    const known = await client().post('/api/v1/auth/forgot-password').send({ email: user.email });
    const unknown = await client()
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@example.edu' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });

  it('resets the password and signs out all sessions', async () => {
    const { agent, user } = await signUp();
    const token = generateToken();
    await prisma.authToken.create({
      data: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const res = await client()
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'NewPassword456' });
    expect(res.status).toBe(200);

    expect((await agent.post('/api/v1/auth/refresh')).status).toBe(401);
    const login = await client()
      .post('/api/v1/auth/login')
      .send({ identifier: user.username, password: 'NewPassword456' });
    expect(login.status).toBe(200);
  });

  it('rejects expired tokens', async () => {
    const { user } = await signUp();
    const token = generateToken();
    await prisma.authToken.create({
      data: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const res = await client()
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'NewPassword456' });
    expect(res.status).toBe(400);
  });
});
