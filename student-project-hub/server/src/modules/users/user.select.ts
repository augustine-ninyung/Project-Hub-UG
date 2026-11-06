import type { Prisma, User } from '../../generated/prisma/client.js';
import { adminTopic, userTopic } from '../../services/realtime.service.js';

/** Minimal public user info embedded in projects, comments, notifications. */
export const userSummarySelect = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
  university: true,
  department: true,
} satisfies Prisma.UserSelect;

/** The signed-in user's own account (includes private fields like email). */
export function toSelfUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    university: user.university,
    department: user.department,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    skills: user.skills,
    githubUrl: user.githubUrl,
    linkedinUrl: user.linkedinUrl,
    portfolioUrl: user.portfolioUrl,
    role: user.role,
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt,
    /** Private Realtime topic for live notification pings. */
    realtimeTopic: userTopic(user.id),
    /** Admins only: live pings for the admin dashboard. */
    ...(user.role === 'ADMIN' ? { adminTopic: adminTopic() } : {}),
  };
}
