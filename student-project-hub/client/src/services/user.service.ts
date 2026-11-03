import type {
  ActiveUser,
  Invitation,
  Notification,
  Profile,
  ReportReason,
  SelfUser,
  UserSummary,
} from '@/types/api';
import { api, request, type ApiEnvelope } from './api';

export interface ProfileUpdate {
  fullName?: string;
  username?: string;
  university?: string;
  department?: string;
  bio?: string | null;
  skills?: string[];
  githubUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
}

export const userService = {
  profile: (idOrUsername: string) => request<Profile>({ url: `/users/${idOrUsername}` }),
  search: (search: string) => request<UserSummary[]>({ url: '/users', params: { search } }),
  active: (limit = 8) => request<ActiveUser[]>({ url: '/users/active', params: { limit } }),
  updateMe: (data: ProfileUpdate) =>
    request<{ user: SelfUser }>({ method: 'PATCH', url: '/users/me', data }).then((d) => d.user),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return request<{ user: SelfUser }>({ method: 'POST', url: '/users/me/avatar', data: form }).then(
      (d) => d.user,
    );
  },
  removeAvatar: () =>
    request<{ user: SelfUser }>({ method: 'DELETE', url: '/users/me/avatar' }).then((d) => d.user),
  invitations: () => request<Invitation[]>({ url: '/users/me/invitations' }),
};

export const notificationService = {
  list: async (page: number, unread = false) => {
    const res = await api.get<ApiEnvelope<Notification[]>>('/notifications', {
      params: { page, limit: 20, unread },
    });
    return { items: res.data.data, meta: res.data.meta! };
  },
  unreadCount: () =>
    request<{ count: number }>({ url: '/notifications/unread-count' }).then((d) => d.count),
  markRead: (id: string) => request({ method: 'PATCH', url: `/notifications/${id}/read` }),
  markAllRead: () => request({ method: 'PATCH', url: '/notifications/read-all' }),
};

export const reportService = {
  create: (data: {
    targetType: 'PROJECT' | 'COMMENT';
    targetId: string;
    reason: ReportReason;
    details?: string;
  }) => request({ method: 'POST', url: '/reports', data }),
};
