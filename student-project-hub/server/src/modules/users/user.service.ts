import { prisma } from '../../config/prisma.js';
import { removeImages, storeImage } from '../../services/storage.service.js';
import type { AuthUser } from '../../types/express.js';
import { ApiError } from '../../utils/api-error.js';
import { visibleProjectsWhere } from '../projects/project.access.js';
import { projectCardSelect, toProjectCards } from '../projects/project.service.js';
import { toSelfUser, userSummarySelect } from './user.select.js';
import type { UpdateProfileInput } from './user.schemas.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  if (input.username) {
    const taken = await prisma.user.count({
      where: { username: input.username, id: { not: userId } },
    });
    if (taken) throw ApiError.conflict('This username is already taken');
  }
  const user = await prisma.user.update({ where: { id: userId }, data: input });
  return toSelfUser(user);
}

export async function updateAvatar(userId: string, file: Express.Multer.File) {
  const stored = await storeImage(file, 'avatars', 'avatar');
  const previous = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { avatarPath: true },
  });
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: stored.url, avatarPath: stored.path },
    });
    await removeImages([previous.avatarPath]);
    return toSelfUser(user);
  } catch (err) {
    await removeImages([stored.path]);
    throw err;
  }
}

export async function removeAvatar(userId: string) {
  const previous = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { avatarPath: true },
  });
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null, avatarPath: null },
  });
  await removeImages([previous.avatarPath]);
  return toSelfUser(user);
}

/** Public profile with stats, owned projects and accepted contributions. */
export async function getProfile(identifier: string, viewer?: AuthUser) {
  const user = await prisma.user.findFirst({
    where: UUID_RE.test(identifier) ? { id: identifier } : { username: identifier.toLowerCase() },
    select: {
      ...userSummarySelect,
      bio: true,
      skills: true,
      githubUrl: true,
      linkedinUrl: true,
      portfolioUrl: true,
      role: true,
      status: true,
      createdAt: true,
      lastActiveAt: true,
    },
  });
  if (!user || (user.status === 'SUSPENDED' && viewer?.role !== 'ADMIN')) {
    throw ApiError.notFound('User not found');
  }

  const visible = visibleProjectsWhere(viewer);
  const [owned, contributed, likes] = await Promise.all([
    prisma.project.findMany({
      where: { AND: [visible, { ownerId: user.id }] },
      select: projectCardSelect,
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    prisma.project.findMany({
      where: {
        AND: [visible, { contributors: { some: { userId: user.id, status: 'ACCEPTED' } } }],
      },
      select: projectCardSelect,
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    prisma.project.aggregate({
      where: { ownerId: user.id, visibility: 'PUBLIC' },
      _sum: { likeCount: true },
    }),
  ]);

  const { status: _status, ...profile } = user;
  return {
    ...profile,
    stats: {
      projects: owned.length,
      contributions: contributed.length,
      likesReceived: likes._sum.likeCount ?? 0,
    },
    projects: await toProjectCards(owned, viewer),
    contributions: await toProjectCards(contributed, viewer),
  };
}

/** Username/name search for the contributor picker. */
export async function searchUsers(search: string, limit: number, excludeId?: string) {
  return prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        { username: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
      ],
    },
    select: userSummarySelect,
    orderBy: { username: 'asc' },
    take: limit,
  });
}

/** "Recently active students" on the dashboard. */
export async function recentlyActive(limit: number) {
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', lastActiveAt: { not: null } },
    select: {
      ...userSummarySelect,
      lastActiveAt: true,
      _count: { select: { projects: { where: { visibility: 'PUBLIC' } } } },
    },
    orderBy: { lastActiveAt: 'desc' },
    take: limit,
  });
  return users.map(({ _count, ...u }) => ({ ...u, projectCount: _count.projects }));
}
