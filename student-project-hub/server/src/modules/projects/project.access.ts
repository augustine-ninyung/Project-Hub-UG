import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import type { AuthUser } from '../../types/express.js';
import { ApiError } from '../../utils/api-error.js';

/**
 * Prisma filter for projects a viewer may see: public projects, plus private
 * projects they own, contribute to, or have a pending invitation for (so they
 * can review it before answering). Admins see everything.
 */
export function visibleProjectsWhere(viewer?: AuthUser): Prisma.ProjectWhereInput {
  if (viewer?.role === 'ADMIN') return {};
  if (!viewer) return { visibility: 'PUBLIC' };
  return {
    OR: [
      { visibility: 'PUBLIC' },
      { ownerId: viewer.id },
      {
        contributors: {
          some: { userId: viewer.id, status: { in: ['ACCEPTED', 'PENDING'] } },
        },
      },
    ],
  };
}

/**
 * Loads a project the viewer may see. Private projects the viewer cannot
 * access return 404 rather than 403 so their existence is not revealed.
 */
export async function findVisibleProject(id: string, viewer?: AuthUser) {
  const project = await prisma.project.findFirst({
    where: { id, ...visibleProjectsWhere(viewer) },
    select: { id: true, ownerId: true, title: true, visibility: true },
  });
  if (!project) throw ApiError.notFound('Project not found');
  return project;
}

/** Ensures the viewer can modify the project (owner or admin). */
export async function findManageableProject(id: string, viewer: AuthUser) {
  const project = await findVisibleProject(id, viewer);
  if (project.ownerId !== viewer.id && viewer.role !== 'ADMIN') {
    throw ApiError.forbidden('Only the project owner can modify this project');
  }
  return project;
}
