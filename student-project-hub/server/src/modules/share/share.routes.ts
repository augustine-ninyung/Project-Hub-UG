import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Router, type Request, type Response } from 'express';
import sharp from 'sharp';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';

/**
 * Link previews. Social crawlers (WhatsApp, LinkedIn, X, Slack, ...) don't
 * run JavaScript, so on Vercel requests for /projects/:id from known crawler
 * user agents are routed here (see vercel.json) and get the SPA's HTML with
 * that project's Open Graph tags. Browsers keep getting the static SPA.
 * Only public projects are ever described.
 */
export const shareRouter = Router();

const SOCIAL_BLOCK = /<!-- social:start -->[\s\S]*?<!-- social:end -->/;

let template: string | null | undefined;
function loadTemplate() {
  if (template !== undefined) return template;
  const candidates = [
    path.resolve(process.cwd(), 'client/dist/index.html'),
    path.resolve(process.cwd(), '../client/dist/index.html'),
  ];
  const found = candidates.find((p) => existsSync(p));
  template = found ? readFileSync(found, 'utf8') : null;
  return template;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const summarize = (text: string, max = 200) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
};

interface Meta {
  title: string;
  description: string;
  url: string;
  image: string;
  imageAlt: string;
  type: 'website' | 'article';
}

function socialTags(m: Meta) {
  const e = { ...m, title: escapeHtml(m.title), description: escapeHtml(m.description), imageAlt: escapeHtml(m.imageAlt) };
  return [
    '<!-- social:start -->',
    `<title>${e.title}</title>`,
    `<meta name="description" content="${e.description}" />`,
    `<link rel="canonical" href="${e.url}" />`,
    `<meta property="og:type" content="${e.type}" />`,
    '<meta property="og:site_name" content="ProjectHub" />',
    `<meta property="og:title" content="${e.title}" />`,
    `<meta property="og:description" content="${e.description}" />`,
    `<meta property="og:url" content="${e.url}" />`,
    `<meta property="og:image" content="${e.image}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${e.imageAlt}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${e.title}" />`,
    `<meta name="twitter:description" content="${e.description}" />`,
    `<meta name="twitter:image" content="${e.image}" />`,
    '<!-- social:end -->',
  ].join('\n    ');
}

function render(meta: Meta) {
  const tags = socialTags(meta);
  const html = loadTemplate();
  if (html && SOCIAL_BLOCK.test(html)) return html.replace(SOCIAL_BLOCK, tags);
  // No built client available (e.g. API-only dev server): a minimal document.
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8" />\n    ${tags}\n</head><body><a href="${escapeHtml(meta.url)}">${escapeHtml(meta.title)}</a></body></html>`;
}

const SITE_DESCRIPTION =
  'The community where students showcase websites, apps, AI models, hardware and designs, get feedback from peers and find collaborators.';

const siteMeta = (url: string): Meta => ({
  title: 'ProjectHub — Where student projects get seen',
  description: SITE_DESCRIPTION,
  url,
  image: `${env.CLIENT_URL}/og-image.png`,
  imageAlt: 'ProjectHub',
  type: 'website',
});

const idSchema = z.string().uuid();

function findPublicProject(id: string) {
  return prisma.project.findFirst({
    where: { id, visibility: 'PUBLIC' },
    select: {
      id: true,
      title: true,
      description: true,
      coverImageUrl: true,
      owner: { select: { fullName: true, university: true } },
      category: { select: { name: true } },
    },
  });
}

shareRouter.get('/projects/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const url = `${env.CLIENT_URL}/projects/${encodeURIComponent(id)}`;
  const project = idSchema.safeParse(id).success ? await findPublicProject(id) : null;

  const meta: Meta = project
    ? {
        title: `${project.title} — ProjectHub`,
        description: summarize(
          `${project.category.name} project by ${project.owner.fullName} (${project.owner.university}). ${project.description}`,
        ),
        url,
        image: `${env.CLIENT_URL}/og/projects/${project.id}.jpg`,
        imageAlt: project.title,
        type: 'article',
      }
    : siteMeta(url);

  res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
  res.type('html').send(render(meta));
});

/** 1200x630 JPEG of the project's cover, which every social network accepts. */
shareRouter.get('/og/projects/:file', async (req: Request, res: Response) => {
  const fallback = () => res.redirect(302, `${env.CLIENT_URL}/og-image.png`);
  const id = String(req.params.file).replace(/\.jpg$/, '');
  if (!idSchema.safeParse(id).success) return fallback();

  const project = await findPublicProject(id);
  const cover = project?.coverImageUrl;
  // Only fetch from our own storage, never an arbitrary URL.
  const trusted = [env.SUPABASE_URL, env.API_URL].filter(Boolean) as string[];
  if (!cover || !trusted.some((origin) => cover.startsWith(`${origin}/`))) return fallback();

  try {
    const upstream = await fetch(cover, { signal: AbortSignal.timeout(5000) });
    if (!upstream.ok) return fallback();
    const image = await sharp(Buffer.from(await upstream.arrayBuffer()), { limitInputPixels: 50_000_000 })
      .resize(1200, 630, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.type('jpeg').send(image);
  } catch {
    fallback();
  }
});
