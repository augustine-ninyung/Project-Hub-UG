import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import type { AuthUser } from '../../types/express.js';
import { ApiError } from '../../utils/api-error.js';
import { slugify } from '../../utils/common-schemas.js';
import { deleteComment } from '../engagement/engagement.service.js';
import { notify } from '../notifications/notification.service.js';
import { deleteProject } from '../projects/project.service.js';
import { userSummarySelect } from '../users/user.select.js';
import type { AdminProjectsQuery, AdminReportsQuery, AdminUsersQuery } from './admin.schemas.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getStatistics() {
  const weekAgo = new Date(Date.now() - 7 * DAY_MS);
  const twoWeeksAgo = new Date(Date.now() - 14 * DAY_MS);

  const [
    users,
    newUsers,
    activeUsers,
    projects,
    publicProjects,
    newProjects,
    comments,
    likes,
    pendingReports,
    byCategory,
    recentSignups,
    recentProjects,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { lastActiveAt: { gte: weekAgo } } }),
    prisma.project.count(),
    prisma.project.count({ where: { visibility: 'PUBLIC' } }),
    prisma.project.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.comment.count({ where: { deletedAt: null } }),
    prisma.like.count(),
    prisma.report.count({ where: { status: 'PENDING' } }),
    prisma.category.findMany({
      select: { name: true, _count: { select: { projects: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({ where: { createdAt: { gte: twoWeeksAgo } }, select: { createdAt: true } }),
    prisma.project.findMany({
      where: { createdAt: { gte: twoWeeksAgo } },
      select: { createdAt: true },
    }),
  ]);

  // Daily series for the last 14 days (UTC dates).
  const days = Array.from({ length: 14 }, (_, i) =>
    new Date(Date.now() - (13 - i) * DAY_MS).toISOString().slice(0, 10),
  );
  const countByDay = (rows: { createdAt: Date }[]) => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const d = r.createdAt.toISOString().slice(0, 10);
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    return counts;
  };
  const signupCounts = countByDay(recentSignups);
  const projectCounts = countByDay(recentProjects);

  return {
    totals: {
      users,
      newUsers,
      activeUsers,
      projects,
      publicProjects,
      newProjects,
      comments,
      likes,
      pendingReports,
    },
    projectsByCategory: byCategory.map((c) => ({ name: c.name, count: c._count.projects })),
    daily: days.map((date) => ({
      date,
      signups: signupCounts.get(date) ?? 0,
      projects: projectCounts.get(date) ?? 0,
    })),
  };
}

/** Recent platform events merged into a single timeline. */
export async function getActivity(limit = 30) {
  const [users, projects, comments, reports] = await Promise.all([
    prisma.user.findMany({
      select: { ...userSummarySelect, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.project.findMany({
      select: { id: true, title: true, createdAt: true, owner: { select: userSummarySelect } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.comment.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: userSummarySelect },
        project: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.report.findMany({
      select: {
        id: true,
        reason: true,
        targetType: true,
        createdAt: true,
        reporter: { select: userSummarySelect },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
  ]);

  const events = [
    ...users.map(({ createdAt, ...user }) => ({
      id: `user-${user.id}`,
      type: 'USER_REGISTERED' as const,
      createdAt,
      actor: user,
      summary: 'joined the platform',
      projectId: null as string | null,
    })),
    ...projects.map((p) => ({
      id: `project-${p.id}`,
      type: 'PROJECT_CREATED' as const,
      createdAt: p.createdAt,
      actor: p.owner,
      summary: `published "${p.title}"`,
      projectId: p.id,
    })),
    ...comments.map((c) => ({
      id: `comment-${c.id}`,
      type: 'COMMENT_CREATED' as const,
      createdAt: c.createdAt,
      actor: c.author,
      summary: `commented on "${c.project.title}"`,
      projectId: c.project.id,
    })),
    ...reports.map((r) => ({
      id: `report-${r.id}`,
      type: 'CONTENT_REPORTED' as const,
      createdAt: r.createdAt,
      actor: r.reporter,
      summary: `reported a ${r.targetType.toLowerCase()} (${r.reason.toLowerCase().replace(/_/g, ' ')})`,
      projectId: null,
    })),
  ];
  return events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}

export async function listUsers(query: AdminUsersQuery) {
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.verified !== undefined
      ? { emailVerifiedAt: query.verified ? { not: null } : null }
      : {}),
    ...(query.search
      ? {
          OR: [
            { username: { contains: query.search, mode: 'insensitive' } },
            { fullName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: {
        ...userSummarySelect,
        email: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        lastActiveAt: true,
        createdAt: true,
        _count: { select: { projects: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total };
}

export async function updateUser(
  id: string,
  admin: AuthUser,
  input: { role?: 'STUDENT' | 'ADMIN'; status?: 'ACTIVE' | 'SUSPENDED' },
) {
  if (id === admin.id) throw ApiError.badRequest('You cannot change your own role or status');
  const user = await prisma.user.update({
    where: { id },
    data: input,
    select: { ...userSummarySelect, email: true, role: true, status: true },
  });
  if (input.status === 'SUSPENDED') {
    // End all active sessions immediately.
    await prisma.userSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  return user;
}

/**
 * Marks a user's email as verified on an admin's say-so, for students whose
 * verification email never arrived. One-way: there is no un-verify.
 */
export async function verifyUserEmail(id: string, admin: AuthUser) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    // Conditional update so two admins clicking at once can't both "verify".
    const { count } = await tx.user.updateMany({
      where: { id, emailVerifiedAt: null },
      data: { emailVerifiedAt: now },
    });
    if (count === 0) {
      const exists = await tx.user.count({ where: { id } });
      throw exists
        ? ApiError.conflict('This email is already verified')
        : ApiError.notFound('User not found');
    }
    // Any verification links still in their inbox are no longer needed.
    await tx.authToken.updateMany({
      where: { userId: id, type: 'EMAIL_VERIFICATION', usedAt: null },
      data: { usedAt: now },
    });
    await notify(tx, {
      type: 'ACCOUNT_VERIFIED',
      recipientId: id,
      actorId: admin.id,
      message: 'verified your account. You can now upload projects and comment.',
    });
    return tx.user.findUniqueOrThrow({
      where: { id },
      select: { ...userSummarySelect, email: true, emailVerifiedAt: true },
    });
  });
}

export async function listProjects(query: AdminProjectsQuery) {
  const where: Prisma.ProjectWhereInput = {
    ...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
    ...(query.visibility ? { visibility: query.visibility } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { owner: { username: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      select: {
        id: true,
        title: true,
        coverImageUrl: true,
        visibility: true,
        status: true,
        isFeatured: true,
        likeCount: true,
        commentCount: true,
        createdAt: true,
        owner: { select: userSummarySelect },
        category: { select: { id: true, name: true } },
        _count: { select: { reports: { where: { status: 'PENDING' } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.project.count({ where }),
  ]);
  return {
    items: items.map(({ _count, ...p }) => ({ ...p, pendingReports: _count.reports })),
    total,
  };
}

export async function setFeatured(id: string, isFeatured: boolean) {
  const project = await prisma.project.findUnique({ where: { id }, select: { visibility: true } });
  if (!project) throw ApiError.notFound('Project not found');
  if (isFeatured && project.visibility !== 'PUBLIC') {
    throw ApiError.badRequest('Only public projects can be featured');
  }
  return prisma.project.update({
    where: { id },
    data: { isFeatured, featuredAt: isFeatured ? new Date() : null },
    select: { id: true, isFeatured: true, featuredAt: true },
  });
}

export async function listReports(query: AdminReportsQuery) {
  const where: Prisma.ReportWhereInput = query.status ? { status: query.status } : {};
  const [items, total] = await prisma.$transaction([
    prisma.report.findMany({
      where,
      select: {
        id: true,
        targetType: true,
        reason: true,
        details: true,
        status: true,
        resolutionNote: true,
        reviewedAt: true,
        createdAt: true,
        reporter: { select: userSummarySelect },
        reviewedBy: { select: userSummarySelect },
        project: { select: { id: true, title: true, owner: { select: userSummarySelect } } },
        comment: {
          select: {
            id: true,
            content: true,
            deletedAt: true,
            projectId: true,
            author: { select: userSummarySelect },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.report.count({ where }),
  ]);
  return { items, total };
}

export async function reviewReport(
  id: string,
  admin: AuthUser,
  input: { status: 'RESOLVED' | 'DISMISSED'; resolutionNote?: string; removeContent: boolean },
) {
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) throw ApiError.notFound('Report not found');
  if (report.status !== 'PENDING') throw ApiError.badRequest('This report has already been reviewed');

  const reviewData = {
    status: input.status,
    resolutionNote: input.resolutionNote,
    reviewedById: admin.id,
    reviewedAt: new Date(),
  };

  if (input.status === 'RESOLVED' && input.removeContent) {
    // Mark every pending report on the same target as resolved, then remove it.
    await prisma.report.updateMany({
      where: {
        status: 'PENDING',
        ...(report.projectId ? { projectId: report.projectId } : { commentId: report.commentId }),
      },
      data: reviewData,
    });
    if (report.commentId) {
      await deleteComment(report.commentId, admin).catch((err) => {
        if (!(err instanceof ApiError && err.statusCode === 404)) throw err;
      });
    } else if (report.projectId) {
      // Cascades to this report as well.
      await deleteProject(report.projectId, admin);
    }
    return { id, ...reviewData, contentRemoved: true };
  }

  const updated = await prisma.report.update({ where: { id }, data: reviewData });
  return { ...updated, contentRemoved: false };
}

export async function createCategory(input: { name: string; description?: string | null }) {
  return prisma.category.create({
    data: { name: input.name, slug: slugify(input.name), description: input.description },
  });
}

export async function updateCategory(id: string, input: { name: string; description?: string | null }) {
  return prisma.category.update({
    where: { id },
    data: { name: input.name, slug: slugify(input.name), description: input.description },
  });
}

export async function deleteCategory(id: string) {
  const inUse = await prisma.project.count({ where: { categoryId: id } });
  if (inUse) {
    throw ApiError.conflict(`This category is used by ${inUse} project(s); reassign them first`);
  }
  await prisma.category.delete({ where: { id } });
}
