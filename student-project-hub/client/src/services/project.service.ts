import type { AxiosProgressEvent } from 'axios';
import type {
  Category,
  CommentNode,
  Contributor,
  ProjectCard,
  ProjectDetail,
  ProjectStatus,
  Technology,
  Visibility,
} from '@/types/api';
import { request, requestPage } from './api';

export type ProjectSort = 'newest' | 'most_liked' | 'most_commented';

export interface ProjectFilters {
  search?: string;
  category?: string;
  technology?: string;
  sort?: ProjectSort;
  page?: number;
  limit?: number;
}

export interface ProjectFormPayload {
  title: string;
  description: string;
  categoryId: string;
  technologies: string[];
  githubUrl: string;
  liveUrl: string;
  status: ProjectStatus;
  visibility: Visibility;
  contributors?: { username: string; role?: string }[];
  removeScreenshotIds?: string[];
  removeCover?: boolean;
}

export interface ProjectUpload {
  data: ProjectFormPayload;
  cover?: File | null;
  screenshots: File[];
  onProgress?: (percent: number) => void;
}

function toFormData({ data, cover, screenshots }: ProjectUpload) {
  const form = new FormData();
  form.append('data', JSON.stringify(data));
  if (cover) form.append('cover', cover);
  for (const file of screenshots) form.append('screenshots', file);
  return form;
}

const progressHandler = (onProgress?: (p: number) => void) =>
  onProgress
    ? (e: AxiosProgressEvent) => {
        if (e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      }
    : undefined;

export const projectService = {
  list: (filters: ProjectFilters) =>
    requestPage<ProjectCard>({ url: '/projects', params: filters }),
  trending: (limit = 6) => request<ProjectCard[]>({ url: '/projects/trending', params: { limit } }),
  featured: (limit = 6) => request<ProjectCard[]>({ url: '/projects/featured', params: { limit } }),
  recommended: (limit = 6) =>
    request<ProjectCard[]>({ url: '/projects/recommended', params: { limit } }),
  get: (id: string) => request<ProjectDetail>({ url: `/projects/${id}` }),
  related: (id: string, limit = 4) =>
    request<ProjectCard[]>({ url: `/projects/${id}/related`, params: { limit } }),

  create: (upload: ProjectUpload) =>
    request<ProjectDetail>({
      method: 'POST',
      url: '/projects',
      data: toFormData(upload),
      onUploadProgress: progressHandler(upload.onProgress),
      timeout: 120_000,
    }),
  update: (id: string, upload: ProjectUpload) =>
    request<ProjectDetail>({
      method: 'PATCH',
      url: `/projects/${id}`,
      data: toFormData(upload),
      onUploadProgress: progressHandler(upload.onProgress),
      timeout: 120_000,
    }),
  remove: (id: string) => request<void>({ method: 'DELETE', url: `/projects/${id}` }),

  like: (id: string) =>
    request<{ liked: boolean; likeCount: number }>({ method: 'POST', url: `/projects/${id}/like` }),
  unlike: (id: string) =>
    request<{ liked: boolean; likeCount: number }>({ method: 'DELETE', url: `/projects/${id}/like` }),

  comments: (id: string, page: number) =>
    requestPage<CommentNode>({ url: `/projects/${id}/comments`, params: { page, limit: 10 } }),
  addComment: (id: string, content: string, parentId?: string) =>
    request<CommentNode>({
      method: 'POST',
      url: `/projects/${id}/comments`,
      data: { content, parentId },
    }),
  editComment: (commentId: string, content: string) =>
    request<CommentNode>({ method: 'PATCH', url: `/comments/${commentId}`, data: { content } }),
  deleteComment: (commentId: string) =>
    request<void>({ method: 'DELETE', url: `/comments/${commentId}` }),

  inviteContributor: (id: string, username: string, role?: string) =>
    request<Contributor>({
      method: 'POST',
      url: `/projects/${id}/contributors`,
      data: { username, role: role || undefined },
    }),
  respondToInvitation: (id: string, userId: string, status: 'ACCEPTED' | 'DECLINED') =>
    request<Contributor>({
      method: 'PATCH',
      url: `/projects/${id}/contributors/${userId}`,
      data: { status },
    }),
  removeContributor: (id: string, userId: string) =>
    request<void>({ method: 'DELETE', url: `/projects/${id}/contributors/${userId}` }),
};

export const metaService = {
  categories: () => request<Category[]>({ url: '/categories' }),
  technologies: (search?: string) =>
    request<Technology[]>({ url: '/technologies', params: { search: search || undefined } }),
};
