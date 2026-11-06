import { describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { client, createCategory, signUp } from './helpers.js';

const login = (identifier: string, extra: Record<string, unknown> = {}) =>
  client().post('/api/v1/auth/login').send({ identifier, password: 'Password123', ...extra });

async function studentWithProject() {
  const category = await createCategory();
  const student = await signUp();
  const project = await student.agent.post('/api/v1/projects').field(
    'data',
    JSON.stringify({
      title: 'Campus Bus Tracker',
      description: 'Live positions of campus shuttles on a map.',
      categoryId: category.id,
      technologies: ['React'],
    }),
  );
  return { ...student, projectId: project.body.data.id as string };
}

describe('account deletion requests', () => {
  it('needs the password, then signs the student out everywhere and hides them', async () => {
    const { agent, user } = await signUp();
    const other = await signUp();

    const wrong = await agent.post('/api/v1/users/me/deletion-request').send({ password: 'nope1234' });
    expect(wrong.status).toBe(422);
    expect(wrong.body.error.details[0]).toMatchObject({ path: 'password' });

    const res = await agent
      .post('/api/v1/users/me/deletion-request')
      .send({ password: 'Password123', reason: 'Graduated' });
    expect(res.status).toBe(200);

    // Existing sessions are gone, including refresh.
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    expect((await agent.post('/api/v1/auth/refresh')).status).toBe(401);
    // Profile hidden from other students.
    expect((await other.agent.get(`/api/v1/users/${user.username}`)).status).toBe(404);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.deletionRequestedAt).not.toBeNull();
    expect(row.deletionReason).toBe('Graduated');
  });

  it('tells the owner at sign-in, and lets them keep the account', async () => {
    const { agent, user } = await signUp();
    await agent.post('/api/v1/users/me/deletion-request').send({ password: 'Password123' }).expect(200);

    // Wrong password gives the usual generic error, revealing nothing.
    const bad = await client().post('/api/v1/auth/login').send({ identifier: user.email, password: 'wrong-pass1' });
    expect(bad.status).toBe(401);

    const pending = await login(user.email);
    expect(pending.status).toBe(403);
    expect(pending.body.error.code).toBe('ACCOUNT_DELETION_PENDING');

    const kept = await login(user.email, { cancelDeletion: true });
    expect(kept.status).toBe(200);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.deletionRequestedAt).toBeNull();
  });

  it('lets an admin delete the account for good, with its content', async () => {
    const { agent, user, projectId } = await studentWithProject();
    const admin = await signUp({ role: 'ADMIN' });
    await agent.post('/api/v1/users/me/deletion-request').send({ password: 'Password123' }).expect(200);

    const listed = await admin.agent.get('/api/v1/admin/users?deletion=requested');
    expect(listed.body.data.map((u: { id: string }) => u.id)).toEqual([user.id]);
    expect((await admin.agent.get('/api/v1/admin/statistics')).body.data.totals.deletionRequests).toBe(1);

    const res = await admin.agent.delete(`/api/v1/admin/users/${user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.projectsRemoved).toBe(1);
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(0);
    expect(await prisma.project.count({ where: { id: projectId } })).toBe(0);
    expect((await login(user.email)).status).toBe(401);
  });

  it('lets an admin keep the account instead', async () => {
    const { agent, user } = await signUp();
    const admin = await signUp({ role: 'ADMIN' });
    await agent.post('/api/v1/users/me/deletion-request').send({ password: 'Password123' }).expect(200);

    await admin.agent.post(`/api/v1/admin/users/${user.id}/keep`).expect(200);
    expect((await login(user.email)).status).toBe(200);
  });

  it('never deletes accounts whose owner did not ask, and is admin-only', async () => {
    const { user } = await signUp();
    const admin = await signUp({ role: 'ADMIN' });
    const student = await signUp();

    expect((await admin.agent.delete(`/api/v1/admin/users/${user.id}`)).status).toBe(409);
    expect((await admin.agent.delete(`/api/v1/admin/users/${admin.user.id}`)).status).toBe(400);
    expect((await student.agent.delete(`/api/v1/admin/users/${user.id}`)).status).toBe(403);
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(1);
  });
});

describe('deleting suspended accounts', () => {
  it('lets an admin delete an account after suspending it, without a request', async () => {
    const { user, projectId } = await studentWithProject();
    const admin = await signUp({ role: 'ADMIN' });

    // Active and never asked: refused.
    expect((await admin.agent.delete(`/api/v1/admin/users/${user.id}`)).status).toBe(409);

    await admin.agent.patch(`/api/v1/admin/users/${user.id}`).send({ status: 'SUSPENDED' }).expect(200);
    const res = await admin.agent.delete(`/api/v1/admin/users/${user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.projectsRemoved).toBe(1);
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(0);
    expect(await prisma.project.count({ where: { id: projectId } })).toBe(0);
  });

  it('keeps "keep account" for real requests only', async () => {
    const { user } = await signUp();
    const admin = await signUp({ role: 'ADMIN' });
    await admin.agent.patch(`/api/v1/admin/users/${user.id}`).send({ status: 'SUSPENDED' }).expect(200);
    expect((await admin.agent.post(`/api/v1/admin/users/${user.id}/keep`)).status).toBe(409);
  });
});
