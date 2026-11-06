import { describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { createCategory, signUp } from './helpers.js';

describe('admin authorization', () => {
  it('rejects students on every admin endpoint', async () => {
    const { agent } = await signUp();
    for (const path of ['statistics', 'users', 'projects', 'reports', 'activity']) {
      const res = await agent.get(`/api/v1/admin/${path}`);
      expect(res.status, path).toBe(403);
    }
  });

  it('serves statistics to admins', async () => {
    const { agent } = await signUp({ role: 'ADMIN' });
    const res = await agent.get('/api/v1/admin/statistics');
    expect(res.status).toBe(200);
    expect(res.body.data.totals.users).toBe(1);
    expect(res.body.data.totals.unverifiedUsers).toBe(0);
    expect(res.body.data.daily).toHaveLength(14);
  });
});

describe('admin moderation', () => {
  it('suspends a user and revokes their sessions', async () => {
    const { agent: admin } = await signUp({ role: 'ADMIN' });
    const { agent: student, user } = await signUp();

    const res = await admin.patch(`/api/v1/admin/users/${user.id}`).send({ status: 'SUSPENDED' });
    expect(res.status).toBe(200);
    expect((await student.get('/api/v1/auth/me')).status).toBe(401);
    expect((await student.post('/api/v1/auth/refresh')).status).toBe(401);
  });

  it('cannot change own role', async () => {
    const { agent, user } = await signUp({ role: 'ADMIN' });
    const res = await agent.patch(`/api/v1/admin/users/${user.id}`).send({ role: 'STUDENT' });
    expect(res.status).toBe(400);
  });

  it('features projects and resolves reports by removing content', async () => {
    const category = await createCategory();
    const { agent: admin } = await signUp({ role: 'ADMIN' });
    const { agent: owner } = await signUp();
    const { agent: reporter } = await signUp();

    const created = await owner.post('/api/v1/projects').field(
      'data',
      JSON.stringify({
        title: 'Spam project',
        description: 'Buy cheap things here, definitely not spam at all.',
        categoryId: category.id,
        technologies: ['HTML'],
      }),
    );
    const projectId = created.body.data.id;

    const feature = await admin
      .patch(`/api/v1/admin/projects/${projectId}/feature`)
      .send({ isFeatured: true });
    expect(feature.body.data.isFeatured).toBe(true);

    const report = await reporter
      .post('/api/v1/reports')
      .send({ targetType: 'PROJECT', targetId: projectId, reason: 'SPAM' });

    const list = await admin.get('/api/v1/admin/reports?status=PENDING');
    expect(list.body.data).toHaveLength(1);

    const review = await admin
      .patch(`/api/v1/admin/reports/${report.body.data.id}`)
      .send({ status: 'RESOLVED', removeContent: true });
    expect(review.status).toBe(200);
    expect(await prisma.project.count()).toBe(0);
  });

  it('manages categories and blocks deleting categories in use', async () => {
    const { agent: admin } = await signUp({ role: 'ADMIN' });
    const created = await admin.post('/api/v1/admin/categories').send({ name: 'Robotics' });
    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe('robotics');

    const duplicate = await admin.post('/api/v1/admin/categories').send({ name: 'Robotics' });
    expect(duplicate.status).toBe(409);

    await admin.post('/api/v1/projects').field(
      'data',
      JSON.stringify({
        title: 'Line follower',
        description: 'A line-following robot built with an Arduino Uno.',
        categoryId: created.body.data.id,
        technologies: ['Arduino'],
      }),
    );
    const blocked = await admin.delete(`/api/v1/admin/categories/${created.body.data.id}`);
    expect(blocked.status).toBe(409);
  });
});

describe('manual email verification', () => {
  const postProject = (agent: Awaited<ReturnType<typeof signUp>>['agent'], categoryId: string) =>
    agent.post('/api/v1/projects').field(
      'data',
      JSON.stringify({
        title: 'Weather station',
        description: 'A solar-powered weather station that reports every minute.',
        categoryId,
        technologies: ['ESP32'],
      }),
    );

  it('lets an admin verify a student, who can then post straight away', async () => {
    const category = await createCategory();
    const { agent: admin, user: adminUser } = await signUp({ role: 'ADMIN' });
    const { agent: student, user } = await signUp({ verified: false });

    expect((await postProject(student, category.id)).status).toBe(403);

    const res = await admin.post(`/api/v1/admin/users/${user.id}/verify-email`);
    expect(res.status).toBe(200);
    expect(res.body.data.emailVerifiedAt).toBeTruthy();

    // Takes effect on the student's existing session, no re-login needed.
    expect((await student.get('/api/v1/auth/me')).body.data.user.emailVerified).toBe(true);
    expect((await postProject(student, category.id)).status).toBe(201);

    const notifications = await prisma.notification.findMany({ where: { recipientId: user.id } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ type: 'ACCOUNT_VERIFIED', actorId: adminUser.id });

    const unusedTokens = await prisma.authToken.count({
      where: { userId: user.id, type: 'EMAIL_VERIFICATION', usedAt: null },
    });
    expect(unusedTokens).toBe(0);
  });

  it('refuses to verify twice and reports unknown users', async () => {
    const { agent: admin } = await signUp({ role: 'ADMIN' });
    const { user } = await signUp({ verified: false });

    expect((await admin.post(`/api/v1/admin/users/${user.id}/verify-email`)).status).toBe(200);
    expect((await admin.post(`/api/v1/admin/users/${user.id}/verify-email`)).status).toBe(409);
    expect(
      (await admin.post('/api/v1/admin/users/00000000-0000-4000-8000-000000000000/verify-email')).status,
    ).toBe(404);
  });

  it('is admin-only', async () => {
    const { agent: student } = await signUp();
    const { user } = await signUp({ verified: false });

    expect((await student.post(`/api/v1/admin/users/${user.id}/verify-email`)).status).toBe(403);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.emailVerifiedAt).toBeNull();
  });

  it('filters the user list to unverified accounts', async () => {
    const { agent: admin } = await signUp({ role: 'ADMIN' });
    const { user: pending } = await signUp({ verified: false });
    await signUp();

    const res = await admin.get('/api/v1/admin/users?verified=false');
    expect(res.body.data.map((u: { id: string }) => u.id)).toEqual([pending.id]);
    const verified = await admin.get('/api/v1/admin/users?verified=true');
    expect(verified.body.meta.total).toBe(2);
  });
});
