import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEED_TOPIC, projectTopic, realtime, userTopic } from '../src/services/realtime.service.js';
import { createCategory, signUp } from './helpers.js';

const send = vi.fn(async (_topics: string[]) => undefined);
const original = realtime.send;

let owner: Awaited<ReturnType<typeof signUp>>;
let projectId: string;

beforeEach(async () => {
  realtime.send = send;
  const category = await createCategory();
  owner = await signUp({ username: 'owner' });
  const res = await owner.agent.post('/api/v1/projects').field(
    'data',
    JSON.stringify({
      title: 'Live Updates Demo',
      description: 'A project used to check live update pings.',
      categoryId: category.id,
      technologies: ['TypeScript'],
    }),
  );
  projectId = res.body.data.id;
  send.mockClear();
});

afterEach(() => {
  realtime.send = original;
});

describe('live update pings', () => {
  it('pings the project and the owner when someone likes it', async () => {
    const { agent } = await signUp();
    await agent.post(`/api/v1/projects/${projectId}/like`).expect(200);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].sort()).toEqual(
      [projectTopic(projectId), FEED_TOPIC, userTopic(owner.user.id)].sort(),
    );
  });

  it('pings the feed when a project is created, edited or deleted', async () => {
    const category = await createCategory('Robotics');
    const created = await owner.agent
      .post('/api/v1/projects')
      .field(
        'data',
        JSON.stringify({
          title: 'Rover',
          description: 'An autonomous delivery rover for campus.',
          categoryId: category.id,
          technologies: ['ROS'],
        }),
      )
      .expect(201);
    const id = created.body.data.id;
    expect(send.mock.calls.at(-1)![0]).toEqual(expect.arrayContaining([FEED_TOPIC, projectTopic(id)]));

    await owner.agent.patch(`/api/v1/projects/${id}`).field('data', JSON.stringify({ title: 'Rover v2' })).expect(200);
    expect(send.mock.calls.at(-1)![0]).toEqual(expect.arrayContaining([FEED_TOPIC, projectTopic(id)]));

    await owner.agent.delete(`/api/v1/projects/${id}`).expect(204);
    expect(send.mock.calls.at(-1)![0]).toEqual(expect.arrayContaining([FEED_TOPIC, projectTopic(id)]));
  });

  it('pings the project and the parent author on a reply', async () => {
    const { agent, user: commenter } = await signUp();
    const root = await agent
      .post(`/api/v1/projects/${projectId}/comments`)
      .send({ content: 'How did you build this?' })
      .expect(201);
    send.mockClear();

    await owner.agent
      .post(`/api/v1/projects/${projectId}/comments`)
      .send({ content: 'With Supabase Realtime.', parentId: root.body.data.id })
      .expect(201);

    // The owner replying on their own project notifies only the commenter.
    expect(send.mock.calls[0]![0].sort()).toEqual(
      [projectTopic(projectId), FEED_TOPIC, userTopic(commenter.id)].sort(),
    );
  });

  it('sends nothing when the request fails', async () => {
    const { agent } = await signUp();
    await agent.post('/api/v1/projects/00000000-0000-4000-8000-000000000000/like').expect(404);
    expect(send).not.toHaveBeenCalled();
  });

  it('gives each user their own unguessable notification topic', async () => {
    const other = await signUp();
    const me = await owner.agent.get('/api/v1/auth/me').expect(200);
    expect(me.body.data.user.realtimeTopic).toBe(userTopic(owner.user.id));
    expect(userTopic(owner.user.id)).not.toBe(userTopic(other.user.id));
    expect(me.body.data.user.realtimeTopic).not.toContain(owner.user.id);
  });
});
