import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { client, createCategory, PNG_1X1, signUp } from './helpers.js';

let owner: Awaited<ReturnType<typeof signUp>>;
let categoryId: string;

const createProject = (title: string, visibility: 'PUBLIC' | 'PRIVATE' = 'PUBLIC') =>
  owner.agent.post('/api/v1/projects').field(
    'data',
    JSON.stringify({
      title,
      description: 'Indoor navigation for lecture halls, built with React and Node.',
      categoryId,
      technologies: ['React'],
      visibility,
    }),
  );

beforeEach(async () => {
  categoryId = (await createCategory()).id;
  owner = await signUp({ username: 'owner' });
});

afterEach(() => vi.restoreAllMocks());

describe('link previews', () => {
  it('describes a public project with Open Graph tags', async () => {
    const { body } = await createProject('Campus Navigator');
    const res = await client().get(`/projects/${body.data.id}`).expect(200);

    expect(res.type).toBe('text/html');
    expect(res.text).toContain('<meta property="og:title" content="Campus Navigator — ProjectHub" />');
    expect(res.text).toContain('Web Development project by Student');
    expect(res.text).toContain(`/og/projects/${body.data.id}.jpg`);
    expect(res.text).toContain('summary_large_image');
  });

  it('escapes user content in the tags', async () => {
    const { body } = await createProject('"><script>alert(1)</script>');
    const res = await client().get(`/projects/${body.data.id}`).expect(200);
    expect(res.text).not.toContain('<script>alert(1)</script>');
    expect(res.text).toContain('&quot;&gt;&lt;script&gt;');
  });

  it('never describes private or unknown projects', async () => {
    const { body } = await createProject('Secret Thesis Prototype', 'PRIVATE');
    const res = await client().get(`/projects/${body.data.id}`).expect(200);
    expect(res.text).not.toContain('Secret Thesis Prototype');
    expect(res.text).toContain('ProjectHub — Where student projects get seen');

    const unknown = await client().get('/projects/not-a-uuid').expect(200);
    expect(unknown.text).toContain('og-image.png');
  });

  it('falls back to the site image when a project has no cover', async () => {
    const { body } = await createProject('No Cover Yet');
    const res = await client().get(`/og/projects/${body.data.id}.jpg`).expect(302);
    expect(res.headers.location).toMatch(/\/og-image\.png$/);
  });

  it('serves a 1200x630 JPEG of the cover', async () => {
    const created = await owner.agent
      .post('/api/v1/projects')
      .field(
        'data',
        JSON.stringify({
          title: 'With Cover',
          description: 'A project with a cover image for the preview test.',
          categoryId,
          technologies: ['Go'],
        }),
      )
      .attach('cover', PNG_1X1, { filename: 'cover.png', contentType: 'image/png' })
      .expect(201);
    const { coverImageUrl } = await prisma.project.findUniqueOrThrow({
      where: { id: created.body.data.id },
      select: { coverImageUrl: true },
    });
    expect(coverImageUrl).toBeTruthy();

    // The cover lives on the (not running) local storage server; serve it here.
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) =>
      String(input) === coverImageUrl ? new Response(new Uint8Array(PNG_1X1)) : realFetch(input, init),
    );

    const res = await client()
      .get(`/og/projects/${created.body.data.id}.jpg`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.type).toBe('image/jpeg');
    const sharp = (await import('sharp')).default;
    const meta = await sharp(res.body as Buffer).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 630]);
  });
});
