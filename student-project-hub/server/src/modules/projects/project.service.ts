import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { MAX_SCREENSHOTS } from '../../middleware/upload.js';
import { projectChanged } from '../../services/realtime.service.js';
import { removeImages, storeImage, type StoredFile } from '../../services/storage.service.js';
import type { AuthUser } from '../../types/express.js';
import { ApiError } from '../../utils/api-error.js';
import { slugify } from '../../utils/common-schemas.js';
import { notify } from '../notifications/notification.service.js';
import { userSummarySelect } from '../users/user.select.js';
import { findManageableProject, visibleProjectsWhere } from './project.access.js';
import type { CreateProjectInput, ListProjectsQuery, UpdateProjectInput } from './project.schemas.js';

const TRENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface ProjectFiles {
  cover?: Express.Multer.File;
  screenshots: Express.Multer.File[];
}

// ─── Serialisation ─────────────────────────────────────────────────────

export const projectCardSelect = {
  id: true,
  title: true,
  description: true,
  coverImageUrl: true,
  status: true,
  visibility: true,
  likeCount: true,
  commentCount: true,
  isFeatured: true,
  createdAt: true,
  owner: { select: userSummarySelect },
  category: { select: { id: true, name: true, slug: true } },
  technologies: { select: { technology: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.ProjectSelect;

type ProjectCardRow = Prisma.ProjectGetPayload<{ select: typeof projectCardSelect }>;

function excerpt(text: string, max = 180) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

async function likedProjectIds(viewer: AuthUser | undefined, projectIds: string[]) {
  if (!viewer || projectIds.length === 0) return new Set<string>();
  const likes = await prisma.like.findMany({
    where: { userId: viewer.id, projectId: { in: projectIds } },
    select: { projectId: true },
  });
  return new Set(likes.map((l) => l.projectId));
}

/** Converts DB rows to API cards, resolving `likedByMe` in one query. */
export async function toProjectCards(rows: ProjectCardRow[], viewer?: AuthUser) {
  const liked = await likedProjectIds(
    viewer,
    rows.map((r) => r.id),
  );
  return rows.map(({ description, technologies, ...rest }) => ({
    ...rest,
    excerpt: excerpt(description),
    technologies: technologies.map((t) => t.technology),
    likedByMe: liked.has(rest.id),
  }));
}

// ─── Discovery ─────────────────────────────────────────────────────────

const SORTS: Record<ListProjectsQuery['sort'], Prisma.ProjectOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { id: 'asc' }],
  most_liked: [{ likeCount: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
  most_commented: [{ commentCount: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
};

export async function listProjects(query: ListProjectsQuery, viewer?: AuthUser) {
  const search = query.search ?? query.q;
  const where: Prisma.ProjectWhereInput = {
    visibility: 'PUBLIC',
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(query.category ? { category: { slug: query.category } } : {}),
    ...(query.technology
      ? { technologies: { some: { technology: { slug: query.technology } } } }
      : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      select: projectCardSelect,
      orderBy: SORTS[query.sort],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.project.count({ where }),
  ]);
  return { items: await toProjectCards(rows, viewer), total };
}

/** Most-liked public projects excluding the given ids (used as a fallback). */
async function popularRows(limit: number, excludeIds: string[]) {
  if (limit <= 0) return [];
  return prisma.project.findMany({
    where: { visibility: 'PUBLIC', id: { notIn: excludeIds } },
    select: projectCardSelect,
    orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });
}

/** Projects with the most likes in the last 7 days, topped up with all-time popular ones. */
export async function trendingProjects(limit: number, viewer?: AuthUser) {
  const groups = await prisma.like.groupBy({
    by: ['projectId'],
    where: {
      createdAt: { gte: new Date(Date.now() - TRENDING_WINDOW_MS) },
      project: { visibility: 'PUBLIC' },
    },
    _count: { projectId: true },
    orderBy: { _count: { projectId: 'desc' } },
    take: limit,
  });
  const ids = groups.map((g) => g.projectId);
  const rows = await prisma.project.findMany({
    where: { id: { in: ids } },
    select: projectCardSelect,
  });
  rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  rows.push(...(await popularRows(limit - rows.length, ids)));
  return toProjectCards(rows, viewer);
}

export async function featuredProjects(limit: number, viewer?: AuthUser) {
  const rows = await prisma.project.findMany({
    where: { visibility: 'PUBLIC', isFeatured: true },
    select: projectCardSelect,
    orderBy: [{ featuredAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });
  return toProjectCards(rows, viewer);
}

/**
 * Recommends public projects sharing a category or technology with projects
 * the viewer recently liked or built. Falls back to popular projects.
 */
export async function recommendedProjects(limit: number, viewer?: AuthUser) {
  let rows: ProjectCardRow[] = [];

  if (viewer) {
    const signals = await prisma.project.findMany({
      where: {
        OR: [
          { likes: { some: { userId: viewer.id } } },
          { ownerId: viewer.id },
        ],
      },
      select: { categoryId: true, technologies: { select: { technologyId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const categoryIds = [...new Set(signals.map((s) => s.categoryId))];
    const technologyIds = [
      ...new Set(signals.flatMap((s) => s.technologies.map((t) => t.technologyId))),
    ];

    if (categoryIds.length || technologyIds.length) {
      rows = await prisma.project.findMany({
        where: {
          visibility: 'PUBLIC',
          ownerId: { not: viewer.id },
          likes: { none: { userId: viewer.id } },
          OR: [
            { categoryId: { in: categoryIds } },
            { technologies: { some: { technologyId: { in: technologyIds } } } },
          ],
        },
        select: projectCardSelect,
        orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }],
        take: limit,
      });
    }
  }

  rows.push(...(await popularRows(limit - rows.length, rows.map((r) => r.id))));
  return toProjectCards(rows, viewer);
}

// ─── Details ───────────────────────────────────────────────────────────

export async function getProject(id: string, viewer?: AuthUser) {
  const project = await prisma.project.findFirst({
    where: { id, ...visibleProjectsWhere(viewer) },
    include: {
      owner: { select: { ...userSummarySelect, bio: true } },
      category: { select: { id: true, name: true, slug: true } },
      technologies: { select: { technology: { select: { id: true, name: true, slug: true } } } },
      images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' } },
      contributors: {
        select: {
          id: true,
          role: true,
          status: true,
          createdAt: true,
          user: { select: userSummarySelect },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!project) throw ApiError.notFound('Project not found');

  const canManage = viewer?.id === project.ownerId || viewer?.role === 'ADMIN';
  const liked = await likedProjectIds(viewer, [project.id]);
  const { coverImagePath: _cover, technologies, contributors, ...rest } = project;

  return {
    ...rest,
    technologies: technologies.map((t) => t.technology),
    // Pending/declined invitations are only visible to managers and the invitee.
    contributors: contributors.filter(
      (c) => c.status === 'ACCEPTED' || canManage || c.user.id === viewer?.id,
    ),
    likedByMe: liked.has(project.id),
    permissions: { canEdit: canManage, canDelete: canManage },
  };
}

export async function relatedProjects(id: string, limit: number, viewer?: AuthUser) {
  const project = await prisma.project.findFirst({
    where: { id, ...visibleProjectsWhere(viewer) },
    select: { categoryId: true, technologies: { select: { technologyId: true } } },
  });
  if (!project) throw ApiError.notFound('Project not found');

  const rows = await prisma.project.findMany({
    where: {
      id: { not: id },
      visibility: 'PUBLIC',
      OR: [
        { categoryId: project.categoryId },
        {
          technologies: {
            some: { technologyId: { in: project.technologies.map((t) => t.technologyId) } },
          },
        },
      ],
    },
    select: projectCardSelect,
    orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });
  return toProjectCards(rows, viewer);
}

// ─── Mutations ─────────────────────────────────────────────────────────

async function assertCategory(categoryId: string) {
  const exists = await prisma.category.count({ where: { id: categoryId } });
  if (!exists) throw ApiError.badRequest('Selected category does not exist');
}

async function upsertTechnologies(tx: Prisma.TransactionClient, names: string[]) {
  const ids: string[] = [];
  for (const name of names) {
    const slug = slugify(name);
    if (!slug) throw ApiError.badRequest(`"${name}" is not a valid technology name`);
    const tech = await tx.technology.upsert({
      where: { slug },
      create: { name, slug },
      update: {},
      select: { id: true },
    });
    if (!ids.includes(tech.id)) ids.push(tech.id);
  }
  return ids;
}

export async function resolveInvitees(
  invites: { username: string; role?: string }[],
  ownerId: string,
) {
  if (invites.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { username: { in: invites.map((i) => i.username) }, status: 'ACTIVE' },
    select: { id: true, username: true },
  });
  return invites.map((invite) => {
    const user = users.find((u) => u.username === invite.username);
    if (!user) throw ApiError.badRequest(`User @${invite.username} was not found`);
    if (user.id === ownerId) throw ApiError.badRequest('You cannot add yourself as a contributor');
    return { userId: user.id, role: invite.role || null };
  });
}

/** Uploads images, rolling back already-stored files if a later one fails. */
async function storeProjectImages(files: ProjectFiles) {
  const stored: StoredFile[] = [];
  try {
    const cover = files.cover ? await storeImage(files.cover, 'projects/covers', 'cover') : null;
    if (cover) stored.push(cover);
    const screenshots: StoredFile[] = [];
    for (const file of files.screenshots) {
      const shot = await storeImage(file, 'projects/screenshots', 'screenshot');
      stored.push(shot);
      screenshots.push(shot);
    }
    return { cover, screenshots, all: stored };
  } catch (err) {
    await removeImages(stored.map((s) => s.path));
    throw err;
  }
}

export async function createProject(user: AuthUser, input: CreateProjectInput, files: ProjectFiles) {
  await assertCategory(input.categoryId);
  const invitees = await resolveInvitees(input.contributors, user.id);
  const images = await storeProjectImages(files);

  try {
    const project = await prisma.$transaction(async (tx) => {
      const technologyIds = await upsertTechnologies(tx, input.technologies);
      const created = await tx.project.create({
        data: {
          title: input.title,
          description: input.description,
          categoryId: input.categoryId,
          githubUrl: input.githubUrl ?? null,
          liveUrl: input.liveUrl ?? null,
          status: input.status,
          visibility: input.visibility,
          ownerId: user.id,
          coverImageUrl: images.cover?.url,
          coverImagePath: images.cover?.path,
          technologies: { create: technologyIds.map((technologyId) => ({ technologyId })) },
          images: {
            create: images.screenshots.map((s, position) => ({ url: s.url, path: s.path, position })),
          },
          contributors: {
            create: invitees.map((i) => ({ userId: i.userId, role: i.role, invitedById: user.id })),
          },
        },
        select: { id: true, title: true },
      });
      await notify(
        tx,
        invitees.map((i) => ({
          type: 'CONTRIBUTOR_INVITED' as const,
          recipientId: i.userId,
          actorId: user.id,
          projectId: created.id,
          message: `invited you to contribute to "${created.title}"`,
        })),
      );
      return created;
    });
    projectChanged(project.id);
    return getProject(project.id, user);
  } catch (err) {
    await removeImages(images.all.map((s) => s.path));
    throw err;
  }
}

export async function updateProject(
  id: string,
  user: AuthUser,
  input: UpdateProjectInput,
  files: ProjectFiles,
) {
  await findManageableProject(id, user);
  const current = await prisma.project.findUniqueOrThrow({
    where: { id },
    select: { coverImagePath: true, images: { select: { id: true, path: true, position: true } } },
  });
  if (input.categoryId) await assertCategory(input.categoryId);

  const removed = current.images.filter((img) => input.removeScreenshotIds.includes(img.id));
  if (current.images.length - removed.length + files.screenshots.length > MAX_SCREENSHOTS) {
    throw ApiError.badRequest(`A project can have at most ${MAX_SCREENSHOTS} screenshots`);
  }

  const images = await storeProjectImages(files);
  const replaceCover = Boolean(images.cover) || input.removeCover;
  const nextPosition = Math.max(-1, ...current.images.map((i) => i.position)) + 1;

  try {
    await prisma.$transaction(async (tx) => {
      if (input.technologies) {
        const technologyIds = await upsertTechnologies(tx, input.technologies);
        await tx.projectTechnology.deleteMany({ where: { projectId: id } });
        await tx.projectTechnology.createMany({
          data: technologyIds.map((technologyId) => ({ projectId: id, technologyId })),
        });
      }
      if (removed.length) {
        await tx.projectImage.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } });
      }
      if (images.screenshots.length) {
        await tx.projectImage.createMany({
          data: images.screenshots.map((s, i) => ({
            projectId: id,
            url: s.url,
            path: s.path,
            position: nextPosition + i,
          })),
        });
      }
      await tx.project.update({
        where: { id },
        data: {
          title: input.title,
          description: input.description,
          categoryId: input.categoryId,
          githubUrl: input.githubUrl,
          liveUrl: input.liveUrl,
          status: input.status,
          visibility: input.visibility,
          ...(replaceCover
            ? { coverImageUrl: images.cover?.url ?? null, coverImagePath: images.cover?.path ?? null }
            : {}),
        },
      });
    });
  } catch (err) {
    await removeImages(images.all.map((s) => s.path));
    throw err;
  }

  // Only delete old files once the database no longer references them.
  await removeImages([
    ...removed.map((r) => r.path),
    replaceCover ? current.coverImagePath : null,
  ]);
  projectChanged(id);
  return getProject(id, user);
}

export async function deleteProject(id: string, user: AuthUser) {
  await findManageableProject(id, user);
  const project = await prisma.project.findUniqueOrThrow({
    where: { id },
    select: { coverImagePath: true, images: { select: { path: true } } },
  });
  await prisma.project.delete({ where: { id } });
  projectChanged(id);
  await removeImages([project.coverImagePath, ...project.images.map((i) => i.path)]);
}
