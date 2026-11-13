import request from 'supertest';
import type { Role } from '../src/generated/prisma/client.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

export const app = createApp();

/** A cookie-persisting client that sends the CSRF header on every request. */
export function client() {
  return request.agent(app).set('X-Requested-With', 'XMLHttpRequest');
}

let counter = 0;

interface UserOptions {
  /** Confirmed their email (default true). Unconfirmed students can't sign in. */
  verified?: boolean;
  /** Approved by an admin (default: same as verified). */
  approved?: boolean;
  role?: Role;
  username?: string;
}

export const PASSWORD = 'Password123';

/**
 * Registers a student, applies the requested state directly in the database,
 * and signs them in when they're allowed to (confirmed email).
 */
export async function signUp(opts: UserOptions = {}) {
  counter += 1;
  const username = opts.username ?? `student${counter}`;
  const email = `${username}@example.edu`;
  const agent = client();
  const res = await agent.post('/api/v1/auth/register').send({
    fullName: `Student ${counter}`,
    username,
    email,
    password: PASSWORD,
    university: 'University of Ghana',
    department: 'Computer Science',
  });
  if (res.status !== 201) throw new Error(`signUp failed: ${JSON.stringify(res.body)}`);

  const verified = opts.verified !== false;
  const approved = opts.approved ?? verified;
  const row = await prisma.user.update({
    where: { email },
    data: {
      emailVerifiedAt: verified ? new Date() : null,
      approvedAt: approved ? new Date() : null,
      ...(opts.role ? { role: opts.role } : {}),
    },
  });
  if (verified) {
    const login = await agent.post('/api/v1/auth/login').send({ identifier: email, password: PASSWORD });
    if (login.status !== 200) throw new Error(`signUp login failed: ${JSON.stringify(login.body)}`);
  }
  return { agent, user: { id: row.id, username: row.username, email: row.email } };
}

export async function createCategory(name = 'Web Development') {
  return prisma.category.create({
    data: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
  });
}

/** Minimal valid 1x1 PNG. */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
