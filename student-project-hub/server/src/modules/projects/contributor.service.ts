import { prisma } from '../../config/prisma.js';
import type { AuthUser } from '../../types/express.js';
import { ApiError } from '../../utils/api-error.js';
import { notify } from '../notifications/notification.service.js';
import { userSummarySelect } from '../users/user.select.js';
import { findManageableProject, findVisibleProject } from './project.access.js';
import { resolveInvitees } from './project.service.js';

const contributorSelect = {
  id: true,
  role: true,
  status: true,
  createdAt: true,
  user: { select: userSummarySelect },
};

/** Owner (or admin) invites a user; re-inviting after a decline resets to PENDING. */
export async function inviteContributor(
  projectId: string,
  actor: AuthUser,
  input: { username: string; role?: string },
) {
  const project = await findManageableProject(projectId, actor);
  const [invitee] = await resolveInvitees([input], project.ownerId);

  const existing = await prisma.projectContributor.findUnique({
    where: { projectId_userId: { projectId, userId: invitee!.userId } },
  });
  if (existing && existing.status !== 'DECLINED') {
    throw ApiError.conflict(
      existing.status === 'ACCEPTED'
        ? 'This user is already a contributor'
        : 'This user has already been invited',
    );
  }

  return prisma.$transaction(async (tx) => {
    const contributor = await tx.projectContributor.upsert({
      where: { projectId_userId: { projectId, userId: invitee!.userId } },
      create: { projectId, userId: invitee!.userId, role: invitee!.role, invitedById: actor.id },
      update: { status: 'PENDING', role: invitee!.role, invitedById: actor.id, respondedAt: null },
      select: contributorSelect,
    });
    await notify(tx, {
      type: 'CONTRIBUTOR_INVITED',
      recipientId: invitee!.userId,
      actorId: actor.id,
      projectId,
      message: `invited you to contribute to "${project.title}"`,
    });
    return contributor;
  });
}

/**
 * The invitee accepts/declines a pending invitation; the owner (or an admin)
 * may change a contributor's role. Each party can only change their own field.
 */
export async function updateContributor(
  projectId: string,
  userId: string,
  actor: AuthUser,
  input: { status?: 'ACCEPTED' | 'DECLINED'; role?: string | null },
) {
  const contributor = await prisma.projectContributor.findUnique({
    where: { projectId_userId: { projectId, userId } },
    include: { project: { select: { ownerId: true, title: true } } },
  });
  if (!contributor) throw ApiError.notFound('Contributor not found');

  const isInvitee = actor.id === userId;
  const isManager = actor.id === contributor.project.ownerId || actor.role === 'ADMIN';

  if (input.status !== undefined) {
    if (!isInvitee) throw ApiError.forbidden('Only the invited user can respond to an invitation');
    if (contributor.status !== 'PENDING') {
      throw ApiError.badRequest('This invitation has already been answered');
    }
  }
  if (input.role !== undefined && !isManager) {
    throw ApiError.forbidden('Only the project owner can change contributor roles');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.projectContributor.update({
      where: { id: contributor.id },
      data: {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.status ? { status: input.status, respondedAt: new Date() } : {}),
      },
      select: contributorSelect,
    });
    if (input.status) {
      await notify(tx, {
        type: 'CONTRIBUTOR_RESPONDED',
        recipientId: contributor.project.ownerId,
        actorId: actor.id,
        projectId,
        message: `${input.status === 'ACCEPTED' ? 'accepted' : 'declined'} your invitation to contribute to "${contributor.project.title}"`,
      });
    }
    return updated;
  });
}

/** Owner/admin removes a contributor, or a contributor leaves the project. */
export async function removeContributor(projectId: string, userId: string, actor: AuthUser) {
  const project = await findVisibleProject(projectId, actor);
  const isManager = actor.id === project.ownerId || actor.role === 'ADMIN';
  if (!isManager && actor.id !== userId) throw ApiError.forbidden();

  const { count } = await prisma.projectContributor.deleteMany({ where: { projectId, userId } });
  if (count === 0) throw ApiError.notFound('Contributor not found');
}

export async function listInvitations(userId: string) {
  return prisma.projectContributor.findMany({
    where: { userId, status: 'PENDING' },
    select: {
      id: true,
      role: true,
      createdAt: true,
      invitedBy: { select: userSummarySelect },
      project: { select: { id: true, title: true, coverImageUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
