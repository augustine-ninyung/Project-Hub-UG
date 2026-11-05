import type { Category, ReportReason, ReportStatus, Role, UserSummary, Visibility } from '@/types/api';
import { request, requestPage } from './api';

export interface AdminStatistics {
  totals: {
    users: number;
    newUsers: number;
    activeUsers: number;
    projects: number;
    publicProjects: number;
    newProjects: number;
    comments: number;
    likes: number;
    pendingReports: number;
  };
  projectsByCategory: { name: string; count: number }[];
  daily: { date: string; signups: number; projects: number }[];
}

export interface AdminUser extends UserSummary {
  email: string;
  role: Role;
  status: 'ACTIVE' | 'SUSPENDED';
  emailVerifiedAt: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  _count: { projects: number; comments: number };
}

export interface AdminProject {
  id: string;
  title: string;
  coverImageUrl: string | null;
  visibility: Visibility;
  status: string;
  isFeatured: boolean;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  owner: UserSummary;
  category: { id: string; name: string };
  pendingReports: number;
}

export interface AdminReport {
  id: string;
  targetType: 'PROJECT' | 'COMMENT';
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolutionNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  reporter: UserSummary;
  reviewedBy: UserSummary | null;
  project: { id: string; title: string; owner: UserSummary } | null;
  comment: {
    id: string;
    content: string;
    deletedAt: string | null;
    projectId: string;
    author: UserSummary;
  } | null;
}

export interface ActivityEvent {
  id: string;
  type: 'USER_REGISTERED' | 'PROJECT_CREATED' | 'COMMENT_CREATED' | 'CONTENT_REPORTED';
  createdAt: string;
  actor: UserSummary;
  summary: string;
  projectId: string | null;
}

export const adminService = {
  statistics: () => request<AdminStatistics>({ url: '/admin/statistics' }),
  activity: () => request<ActivityEvent[]>({ url: '/admin/activity' }),

  users: (params: { page: number; search?: string; role?: Role; status?: string; verified?: boolean }) =>
    requestPage<AdminUser>({ url: '/admin/users', params }),
  updateUser: (id: string, data: { role?: Role; status?: 'ACTIVE' | 'SUSPENDED' }) =>
    request({ method: 'PATCH', url: `/admin/users/${id}`, data }),
  verifyEmail: (id: string) => request({ method: 'POST', url: `/admin/users/${id}/verify-email` }),

  projects: (params: { page: number; search?: string; featured?: boolean }) =>
    requestPage<AdminProject>({ url: '/admin/projects', params }),
  setFeatured: (id: string, isFeatured: boolean) =>
    request({ method: 'PATCH', url: `/admin/projects/${id}/feature`, data: { isFeatured } }),
  deleteProject: (id: string) => request({ method: 'DELETE', url: `/admin/projects/${id}` }),

  reports: (params: { page: number; status?: ReportStatus }) =>
    requestPage<AdminReport>({ url: '/admin/reports', params }),
  reviewReport: (
    id: string,
    data: { status: 'RESOLVED' | 'DISMISSED'; resolutionNote?: string; removeContent?: boolean },
  ) => request({ method: 'PATCH', url: `/admin/reports/${id}`, data }),

  createCategory: (data: { name: string; description?: string | null }) =>
    request<Category>({ method: 'POST', url: '/admin/categories', data }),
  updateCategory: (id: string, data: { name: string; description?: string | null }) =>
    request<Category>({ method: 'PATCH', url: `/admin/categories/${id}`, data }),
  deleteCategory: (id: string) => request({ method: 'DELETE', url: `/admin/categories/${id}` }),
};
