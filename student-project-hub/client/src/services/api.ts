import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import type { PaginationMeta } from '@/types/api';

export const api = axios.create({
  // Production builds are served from the same origin as the API (Vercel).
  baseURL:
    import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '/api/v1' : 'http://localhost:4000/api/v1'),
  withCredentials: true,
  // Required by the server's CSRF protection on state-changing requests.
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
  timeout: 30_000,
});

interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: { path: string; message: string }[] };
}

export interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta?: PaginationMeta & { unreadCount?: number };
}

/** Unwraps `{ success, data }` responses. */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const res = await api.request<ApiEnvelope<T>>(config);
  return res.data.data;
}

/** Unwraps paginated responses into `{ items, meta }`. */
export async function requestPage<T>(config: AxiosRequestConfig) {
  const res = await api.request<ApiEnvelope<T[]>>(config);
  return { items: res.data.data, meta: res.data.meta! };
}

// ─── Silent session refresh ────────────────────────────────────────────
// Access tokens are short-lived. On a 401 we refresh once (shared across
// concurrent requests) and replay the original request.

const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];
let refreshing: Promise<void> | null = null;

export const SESSION_EXPIRED_EVENT = 'session-expired';

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
  const url = original?.url ?? '';
  if (
    error.response?.status !== 401 ||
    !original ||
    original._retried ||
    NO_REFRESH.some((p) => url.startsWith(p))
  ) {
    throw error;
  }

  original._retried = true;
  try {
    refreshing ??= api.post('/auth/refresh').then(() => undefined);
    await refreshing;
  } catch {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    throw error;
  } finally {
    refreshing = null;
  }
  return api.request(original);
});

// ─── Error helpers ─────────────────────────────────────────────────────

/** An error raised in the browser before a request is sent; its message is shown as-is. */
export class ClientError extends Error {}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (error instanceof ClientError) return error.message;
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined;
    if (body?.error?.message) {
      const first = body.error.details?.[0];
      return body.error.code === 'VALIDATION_ERROR' && first ? first.message : body.error.message;
    }
    // Responses without our JSON body come from the hosting platform, not the API.
    if (error.response?.status === 413) return 'The upload is too large. Try fewer or smaller images.';
    if (error.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection.';
    if (error.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  }
  return fallback;
}

export function getErrorCode(error: unknown): string | undefined {
  if (error instanceof AxiosError) {
    return (error.response?.data as ApiErrorBody | undefined)?.error?.code;
  }
}

export function getStatus(error: unknown): number | undefined {
  return error instanceof AxiosError ? error.response?.status : undefined;
}

/** Field-level validation errors keyed by path, for react-hook-form. */
export function getFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof AxiosError)) return {};
  const details = (error.response?.data as ApiErrorBody | undefined)?.error?.details ?? [];
  return Object.fromEntries(details.map((d) => [d.path, d.message]));
}
