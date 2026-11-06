import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import {
  backupStore,
  exportData,
  readBackup,
  restoreBackup,
  runDailyBackup,
} from '../src/services/backup.service.js';
import { client, createCategory, signUp } from './helpers.js';

const DIR = path.resolve(process.cwd(), env.BACKUP_LOCAL_DIR);
const SECRET = 'test-cron-secret-0123456789';

async function wipe() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Report", "Notification", "Comment", "Like", "ProjectContributor", "ProjectImage", "ProjectTechnology", "Project", "Technology", "Category", "AuthToken", "UserSession", "User" RESTART IDENTITY CASCADE',
  );
}

/** A small community: two students, a project, a like, a comment and a reply. */
async function community() {
  const category = await createCategory();
  const owner = await signUp({ username: 'owner' });
  const fan = await signUp({ username: 'fan' });
  const project = await owner.agent.post('/api/v1/projects').field(
    'data',
    JSON.stringify({
      title: 'Solar Charging Kiosk',
      description: 'A solar kiosk that charges phones on campus.',
      categoryId: category.id,
      technologies: ['Arduino', 'C++'],
    }),
  );
  const projectId = project.body.data.id as string;
  await fan.agent.post(`/api/v1/projects/${projectId}/like`).expect(200);
  const comment = await fan.agent.post(`/api/v1/projects/${projectId}/comments`).send({ content: 'Love this!' });
  await owner.agent
    .post(`/api/v1/projects/${projectId}/comments`)
    .send({ content: 'Thank you!', parentId: comment.body.data.id });
  return { owner, fan, projectId };
}

beforeEach(async () => {
  await rm(DIR, { recursive: true, force: true });
  env.CRON_SECRET = SECRET;
});
afterEach(async () => {
  env.CRON_SECRET = undefined;
  await rm(DIR, { recursive: true, force: true });
});

describe('daily job', () => {
  it('only runs for Vercel Cron with the right secret', async () => {
    expect((await client().get('/api/v1/cron/daily')).status).toBe(401);
    expect((await client().get('/api/v1/cron/daily').set('Authorization', 'Bearer wrong-secret-0000000000')).status).toBe(401);

    env.CRON_SECRET = undefined;
    expect((await client().get('/api/v1/cron/daily').set('Authorization', `Bearer ${SECRET}`)).status).toBe(503);
  });

  it('keeps the database awake and writes a backup', async () => {
    await community();
    const res = await client().get('/api/v1/cron/daily').set('Authorization', `Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(res.body.data.keptAlive).toBe(true);
    expect(res.body.data.backup.counts).toMatchObject({ user: 2, project: 1, like: 1, comment: 2 });
    expect(await readdir(DIR)).toEqual([res.body.data.backup.name]);
  });

  it('removes backups older than 30 days, keeps the rest', async () => {
    const store = backupStore();
    for (const day of ['2026-09-01', '2026-10-20', '2026-11-01']) {
      await store.put(`backup-${day}.json.gz`, Buffer.from('x'));
    }
    const result = await runDailyBackup(new Date('2026-11-06T03:17:00Z'), store);
    expect(result.removed).toEqual(['backup-2026-09-01.json.gz']);
    expect((await readdir(DIR)).sort()).toEqual([
      'backup-2026-10-20.json.gz',
      'backup-2026-11-01.json.gz',
      'backup-2026-11-06.json.gz',
    ]);
  });

  it('never stores sessions or login tokens', async () => {
    await signUp();
    const file = await exportData();
    expect(Object.keys(file.data)).not.toContain('userSession');
    expect(Object.keys(file.data)).not.toContain('authToken');
  });
});

describe('restoring', () => {
  it('brings back everything from a backup into an empty database', async () => {
    const { owner } = await community();
    const before = await exportData();
    const gz = (await runDailyBackup()).name;
    const file = readBackup(await backupStore().get(gz));

    await wipe();
    expect(await prisma.user.count()).toBe(0);
    // A freshly migrated database has the default categories; restore still works.
    await prisma.category.createMany({
      data: [
        { name: 'Robotics', slug: 'robotics' },
        { name: 'Other', slug: 'other' },
      ],
    });

    const restored = await restoreBackup(file);
    expect(restored).toEqual(before.counts);

    // Replies still point at their comments, and old passwords still work.
    const reply = await prisma.comment.findFirstOrThrow({ where: { parentId: { not: null } } });
    expect(await prisma.comment.count({ where: { id: reply.parentId! } })).toBe(1);
    const login = await client()
      .post('/api/v1/auth/login')
      .send({ identifier: owner.user.email, password: 'Password123' });
    expect(login.status).toBe(200);
  });

  it('refuses to restore over existing data', async () => {
    await community();
    const file = await exportData();
    await expect(restoreBackup(file)).rejects.toThrow(/not empty/);
  });
});
