import { describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { client, createCategory, signUp } from './helpers.js';

describe('public stats', () => {
  it('counts only public projects, active students and their likes', async () => {
    const category = await createCategory();
    const owner = await signUp({ username: 'owner' });
    const fan = await signUp({ username: 'fan' });
    const suspended = await signUp({ username: 'gone' });
    await prisma.user.update({
      where: { id: suspended.user.id },
      data: { status: 'SUSPENDED', university: 'KNUST' },
    });

    const create = (title: string, visibility: 'PUBLIC' | 'PRIVATE') =>
      owner.agent.post('/api/v1/projects').field(
        'data',
        JSON.stringify({
          title,
          description: 'A project used to check the public totals.',
          categoryId: category.id,
          technologies: ['Go'],
          visibility,
        }),
      );
    const pub = await create('Public project', 'PUBLIC');
    const priv = await create('Private project', 'PRIVATE');
    await fan.agent.post(`/api/v1/projects/${pub.body.data.id}/like`);
    await owner.agent.post(`/api/v1/projects/${priv.body.data.id}/like`);

    const res = await client().get('/api/v1/stats');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ projects: 1, students: 2, universities: 1, likes: 1 });
  });
});
