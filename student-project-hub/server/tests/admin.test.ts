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
