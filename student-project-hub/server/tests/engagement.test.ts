import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { client, createCategory, signUp } from './helpers.js';

let owner: Awaited<ReturnType<typeof signUp>>;
let projectId: string;

beforeEach(async () => {
  const category = await createCategory();
  owner = await signUp({ username: 'owner' });
  const res = await owner.agent.post('/api/v1/projects').field(
    'data',
    JSON.stringify({
      title: 'Smart Attendance',
      description: 'Face-recognition attendance tracking for lecture rooms.',
      categoryId: category.id,
      technologies: ['Python'],
    }),
  );
  projectId = res.body.data.id;
});

describe('likes', () => {
  it('likes once, ignores duplicates and unlikes', async () => {
    const { agent } = await signUp();

    const first = await agent.post(`/api/v1/projects/${projectId}/like`);
    expect(first.body.data).toEqual({ liked: true, likeCount: 1 });

    const duplicate = await agent.post(`/api/v1/projects/${projectId}/like`);
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.data.likeCount).toBe(1);
    expect(await prisma.like.count()).toBe(1);

    const detail = await agent.get(`/api/v1/projects/${projectId}`);
    expect(detail.body.data.likedByMe).toBe(true);

    const unlike = await agent.delete(`/api/v1/projects/${projectId}/like`);
    expect(unlike.body.data).toEqual({ liked: false, likeCount: 0 });

    const unlikeAgain = await agent.delete(`/api/v1/projects/${projectId}/like`);
    expect(unlikeAgain.body.data.likeCount).toBe(0);
  });

  it('notifies the owner once per unread like, but not for self-likes', async () => {
    const { agent } = await signUp();
    await agent.post(`/api/v1/projects/${projectId}/like`);
    await agent.delete(`/api/v1/projects/${projectId}/like`);
    await agent.post(`/api/v1/projects/${projectId}/like`);
    await owner.agent.post(`/api/v1/projects/${projectId}/like`);

    const notifications = await prisma.notification.findMany({
      where: { recipientId: owner.user.id, type: 'PROJECT_LIKED' },
    });
    expect(notifications).toHaveLength(1);
  });

  it('requires authentication', async () => {
    expect((await client().post(`/api/v1/projects/${projectId}/like`)).status).toBe(401);
  });
});

describe('comments', () => {
  it('creates threaded comments and notifies the right people', async () => {
    const alice = await signUp({ username: 'alice' });
    const bob = await signUp({ username: 'bob' });

    const root = await alice.agent
      .post(`/api/v1/projects/${projectId}/comments`)
      .send({ content: 'Great work!' });
    expect(root.status).toBe(201);

    const reply = await bob.agent
      .post(`/api/v1/projects/${projectId}/comments`)
      .send({ content: 'Agreed', parentId: root.body.data.id });
    expect(reply.status).toBe(201);

    const nested = await alice.agent
      .post(`/api/v1/projects/${projectId}/comments`)
      .send({ content: 'Thanks Bob', parentId: reply.body.data.id });
    expect(nested.status).toBe(201);

    const list = await client().get(`/api/v1/projects/${projectId}/comments`);
    expect(list.body.meta.total).toBe(1);
    const thread = list.body.data[0];
    expect(thread.content).toBe('Great work!');
    expect(thread.replies[0].content).toBe('Agreed');
    expect(thread.replies[0].replies[0].content).toBe('Thanks Bob');

    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    expect(project.commentCount).toBe(3);

    const aliceNotifications = await prisma.notification.findMany({
      where: { recipientId: alice.user.id },
    });
    expect(aliceNotifications.map((n) => n.type)).toEqual(['COMMENT_REPLIED']);
    const ownerNotifications = await prisma.notification.count({
      where: { recipientId: owner.user.id, type: 'PROJECT_COMMENTED' },
    });
    expect(ownerNotifications).toBe(3);
  });

  it('lets only the author edit, and soft-deletes keeping replies', async () => {
    const alice = await signUp();
    const bob = await signUp();
    const root = await alice.agent
      .post(`/api/v1/projects/${projectId}/comments`)
      .send({ content: 'First' });
    const id = root.body.data.id;
    await bob.agent
      .post(`/api/v1/projects/${projectId}/comments`)
      .send({ content: 'Reply', parentId: id });

    expect((await bob.agent.patch(`/api/v1/comments/${id}`).send({ content: 'X' })).status).toBe(403);
    expect((await bob.agent.delete(`/api/v1/comments/${id}`)).status).toBe(403);

    const edited = await alice.agent.patch(`/api/v1/comments/${id}`).send({ content: 'Edited' });
    expect(edited.body.data).toMatchObject({ content: 'Edited', isEdited: true });

    expect((await alice.agent.delete(`/api/v1/comments/${id}`)).status).toBe(204);
    const list = await client().get(`/api/v1/projects/${projectId}/comments`);
    expect(list.body.data[0]).toMatchObject({ isDeleted: true, content: '', author: null });
    expect(list.body.data[0].replies[0].content).toBe('Reply');
  });

  it('rejects empty comments and replies to other projects', async () => {
    const { agent } = await signUp();
    const empty = await agent
      .post(`/api/v1/projects/${projectId}/comments`)
      .send({ content: '   ' });
    expect(empty.status).toBe(422);

    const bogusParent = await agent
      .post(`/api/v1/projects/${projectId}/comments`)
      .send({ content: 'hi', parentId: '00000000-0000-4000-8000-000000000000' });
    expect(bogusParent.status).toBe(400);
  });
});

describe('notifications', () => {
  it('lists, marks read and marks all read', async () => {
    const fan = await signUp();
    await fan.agent.post(`/api/v1/projects/${projectId}/like`);
    await fan.agent.post(`/api/v1/projects/${projectId}/comments`).send({ content: 'Nice' });

    const list = await owner.agent.get('/api/v1/notifications');
    expect(list.body.data).toHaveLength(2);
    expect(list.body.meta.unreadCount).toBe(2);
    expect(list.body.data[0].actor.id).toBe(fan.user.id);

    const one = await owner.agent.patch(`/api/v1/notifications/${list.body.data[0].id}/read`);
    expect(one.status).toBe(200);

    const otherUser = await fan.agent.patch(`/api/v1/notifications/${list.body.data[1].id}/read`);
    expect(otherUser.status).toBe(404);

    await owner.agent.patch('/api/v1/notifications/read-all');
    const count = await owner.agent.get('/api/v1/notifications/unread-count');
    expect(count.body.data.count).toBe(0);
  });
});

describe('reports', () => {
  it('reports a project once', async () => {
    const { agent } = await signUp();
    const body = { targetType: 'PROJECT', targetId: projectId, reason: 'SPAM' };
    expect((await agent.post('/api/v1/reports').send(body)).status).toBe(201);
    expect((await agent.post('/api/v1/reports').send(body)).status).toBe(409);
  });
});
