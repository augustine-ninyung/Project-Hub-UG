import request from 'supertest';
import type { Role } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

export const app = createApp();

/** A cookie-persisting client that sends the CSRF header on every request. */
export function client() {
  return request.agent(app).set('X-Requested-With', 'XMLHttpRequest');
}

let counter = 0;

interface UserOptions {
  verified?: boolean;
  role?: Role;
  username?: string;
}

export async function signUp(opts: UserOptions = {}) {
  counter += 1;
  const username = opts.username ?? `student${counter}`;
  const agent = client();
  const res = await agent.post('/api/v1/auth/register').send({
    fullName: `Student ${counter}`,
    username,
    email: `${username}@example.edu`,
    password: 'Password123',
    university: 'University of Ghana',
    department: 'Computer Science',
  });
  if (res.status !== 201) throw new Error(`signUp failed: ${JSON.stringify(res.body)}`);

  const userId: string = res.body.data.user.id;
  if (opts.verified !== false || opts.role) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(opts.verified !== false ? { emailVerifiedAt: new Date() } : {}),
        ...(opts.role ? { role: opts.role } : {}),
      },
    });
  }
  return { agent, user: res.body.data.user as { id: string; username: string; email: string } };
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
