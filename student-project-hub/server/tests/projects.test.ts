import { existsSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { LOCAL_UPLOAD_DIR } from '../src/services/storage.service.js';
import { client, createCategory, PNG_1X1, signUp } from './helpers.js';

let categoryId: string;

beforeEach(async () => {
  categoryId = (await createCategory()).id;
});

function projectData(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Campus Navigator',
    description: 'An indoor navigation app for finding lecture halls on campus.',
    categoryId,
    technologies: ['React', 'TypeScript', 'react'],
    githubUrl: 'https://github.com/example/campus-navigator',
    liveUrl: '',
    status: 'ONGOING',
    visibility: 'PUBLIC',
    ...overrides,
  };
}

async function createProject(agent: ReturnType<typeof client>, overrides = {}) {
  const res = await agent
    .post('/api/v1/projects')
    .field('data', JSON.stringify(projectData(overrides)));
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return res.body.data as { id: string };
}

describe('POST /projects', () => {
  it('creates a project with cover and screenshots', async () => {
    const { agent, user } = await signUp();
    const res = await agent
      .post('/api/v1/projects')
      .field('data', JSON.stringify(projectData()))
      .attach('cover', PNG_1X1, { filename: 'cover.png', contentType: 'image/png' })
      .attach('screenshots', PNG_1X1, { filename: 's1.png', contentType: 'image/png' })
      .attach('screenshots', PNG_1X1, { filename: 's2.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    const project = res.body.data;
    expect(project.owner.id).toBe(user.id);
    expect(project.coverImageUrl).toMatch(/\/uploads\/projects\/covers\/.+\.webp$/);
    expect(project.images).toHaveLength(2);
    // Duplicate technologies (case-insensitive) are collapsed.
    expect(project.technologies.map((t: { name: string }) => t.name)).toEqual([
      'React',
      'TypeScript',
    ]);
    expect(project.liveUrl).toBeNull();
    expect(project.permissions).toEqual({ canEdit: true, canDelete: true });

    const stored = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(existsSync(path.join(LOCAL_UPLOAD_DIR, stored.coverImagePath!))).toBe(true);
  });

  it('requires authentication', async () => {
    const res = await client()
      .post('/api/v1/projects')
      .field('data', JSON.stringify(projectData()));
    expect(res.status).toBe(401);
  });

  it('requires a verified email', async () => {
    const { agent } = await signUp({ verified: false });
    const res = await agent.post('/api/v1/projects').field('data', JSON.stringify(projectData()));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('validates fields', async () => {
    const { agent } = await signUp();
    const res = await agent
      .post('/api/v1/projects')
      .field(
        'data',
        JSON.stringify(projectData({ title: 'x', githubUrl: 'javascript:alert(1)', technologies: [] })),
      );
    expect(res.status).toBe(422);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['title', 'githubUrl', 'technologies']));
  });

  it('rejects files that are not real images', async () => {
    const { agent } = await signUp();
    const res = await agent
      .post('/api/v1/projects')
      .field('data', JSON.stringify(projectData()))
      .attach('cover', Buffer.from('<script>alert(1)</script>'), {
        filename: 'evil.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(400);
    expect(await prisma.project.count()).toBe(0);
  });

  it('invites contributors and notifies them', async () => {
    const { agent } = await signUp();
    const { user: friend } = await signUp({ username: 'friend' });
    const res = await agent
      .post('/api/v1/projects')
      .field(
        'data',
        JSON.stringify(projectData({ contributors: [{ username: 'friend', role: 'Designer' }] })),
      );
    expect(res.status).toBe(201);
    const notifications = await prisma.notification.findMany({ where: { recipientId: friend.id } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.type).toBe('CONTRIBUTOR_INVITED');
  });
});

describe('project visibility and authorization', () => {
  it('hides private projects from other users and anonymous visitors', async () => {
    const { agent: owner } = await signUp();
    const { agent: other } = await signUp();
    const project = await createProject(owner, { visibility: 'PRIVATE' });

    expect((await owner.get(`/api/v1/projects/${project.id}`)).status).toBe(200);
    expect((await other.get(`/api/v1/projects/${project.id}`)).status).toBe(404);
    expect((await client().get(`/api/v1/projects/${project.id}`)).status).toBe(404);

    const list = await client().get('/api/v1/projects');
    expect(list.body.data).toHaveLength(0);
  });

  it('lets admins view private projects', async () => {
    const { agent: owner } = await signUp();
    const { agent: admin } = await signUp({ role: 'ADMIN' });
    const project = await createProject(owner, { visibility: 'PRIVATE' });
    expect((await admin.get(`/api/v1/projects/${project.id}`)).status).toBe(200);
  });

  it('only allows the owner or an admin to update and delete', async () => {
    const { agent: owner } = await signUp();
    const { agent: other } = await signUp();
    const { agent: admin } = await signUp({ role: 'ADMIN' });
    const project = await createProject(owner);

    const forbidden = await other
      .patch(`/api/v1/projects/${project.id}`)
      .field('data', JSON.stringify({ title: 'Hijacked' }));
    expect(forbidden.status).toBe(403);
    expect((await other.delete(`/api/v1/projects/${project.id}`)).status).toBe(403);

    const updated = await owner
      .patch(`/api/v1/projects/${project.id}`)
      .field('data', JSON.stringify({ title: 'Campus Navigator v2', status: 'COMPLETED' }));
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ title: 'Campus Navigator v2', status: 'COMPLETED' });

    expect((await admin.delete(`/api/v1/projects/${project.id}`)).status).toBe(204);
    expect(await prisma.project.count()).toBe(0);
  });

  it('removes screenshots on update and deletes the files', async () => {
    const { agent } = await signUp();
    const created = await agent
      .post('/api/v1/projects')
      .field('data', JSON.stringify(projectData()))
      .attach('screenshots', PNG_1X1, { filename: 's1.png', contentType: 'image/png' });
    const image = created.body.data.images[0];
    const { path: imagePath } = await prisma.projectImage.findUniqueOrThrow({
      where: { id: image.id },
    });

    const res = await agent
      .patch(`/api/v1/projects/${created.body.data.id}`)
      .field('data', JSON.stringify({ removeScreenshotIds: [image.id] }));
    expect(res.status).toBe(200);
    expect(res.body.data.images).toHaveLength(0);
    expect(existsSync(path.join(LOCAL_UPLOAD_DIR, imagePath))).toBe(false);
  });
});

describe('discovery', () => {
  it('searches, filters and sorts public projects with pagination', async () => {
    const { agent } = await signUp();
    const mobile = await createCategory('Mobile Development');
    await createProject(agent, { title: 'Alpha Web App' });
    await createProject(agent, {
      title: 'Beta Mobile App',
      categoryId: mobile.id,
      technologies: ['Flutter'],
    });
    await createProject(agent, { title: 'Gamma Secret', visibility: 'PRIVATE' });

    const all = await client().get('/api/v1/projects?limit=1');
    expect(all.body.meta).toMatchObject({ total: 2, totalPages: 2, page: 1 });

    const search = await client().get('/api/v1/projects/search?q=beta');
    expect(search.body.data.map((p: { title: string }) => p.title)).toEqual(['Beta Mobile App']);

    const byCategory = await client().get('/api/v1/projects?category=mobile-development');
    expect(byCategory.body.data).toHaveLength(1);

    const byTech = await client().get('/api/v1/projects?technology=react');
    expect(byTech.body.data.map((p: { title: string }) => p.title)).toEqual(['Alpha Web App']);
  });

  it('returns trending and featured projects', async () => {
    const { agent } = await signUp();
    const { agent: fan } = await signUp();
    const a = await createProject(agent, { title: 'Project A' });
    const b = await createProject(agent, { title: 'Project B' });
    await fan.post(`/api/v1/projects/${b.id}/like`);
    await prisma.project.update({ where: { id: a.id }, data: { isFeatured: true } });

    const trending = await client().get('/api/v1/projects/trending');
    expect(trending.body.data[0].id).toBe(b.id);

    const featured = await client().get('/api/v1/projects/featured');
    expect(featured.body.data.map((p: { id: string }) => p.id)).toEqual([a.id]);
  });
});

describe('contributors', () => {
  it('lets the invitee accept and notifies the owner', async () => {
    const { agent: owner, user: ownerUser } = await signUp();
    const { agent: invitee, user: inviteeUser } = await signUp({ username: 'collab' });
    const project = await createProject(owner, { visibility: 'PRIVATE' });

    const invite = await owner
      .post(`/api/v1/projects/${project.id}/contributors`)
      .send({ username: 'collab', role: 'Backend' });
    expect(invite.status).toBe(201);

    // The pending invitee can view the private project before answering.
    expect((await invitee.get(`/api/v1/projects/${project.id}`)).status).toBe(200);

    // Owner cannot answer on the invitee's behalf.
    const ownerAccept = await owner
      .patch(`/api/v1/projects/${project.id}/contributors/${inviteeUser.id}`)
      .send({ status: 'ACCEPTED' });
    expect(ownerAccept.status).toBe(403);

    const accept = await invitee
      .patch(`/api/v1/projects/${project.id}/contributors/${inviteeUser.id}`)
      .send({ status: 'ACCEPTED' });
    expect(accept.status).toBe(200);
    expect(accept.body.data.status).toBe('ACCEPTED');

    const ownerNotifications = await prisma.notification.findMany({
      where: { recipientId: ownerUser.id, type: 'CONTRIBUTOR_RESPONDED' },
    });
    expect(ownerNotifications).toHaveLength(1);

    const profile = await client().get(`/api/v1/users/collab`);
    // Private project is not listed publicly even for an accepted contributor.
    expect(profile.body.data.contributions).toHaveLength(0);
  });

  it('prevents duplicate invitations and self-invites', async () => {
    const { agent: owner, user } = await signUp();
    await signUp({ username: 'buddy' });
    const project = await createProject(owner);
    await owner.post(`/api/v1/projects/${project.id}/contributors`).send({ username: 'buddy' });
    const again = await owner
      .post(`/api/v1/projects/${project.id}/contributors`)
      .send({ username: 'buddy' });
    expect(again.status).toBe(409);
    const self = await owner
      .post(`/api/v1/projects/${project.id}/contributors`)
      .send({ username: user.username });
    expect(self.status).toBe(400);
  });
});
