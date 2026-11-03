import type { SelfUser } from '@/types/api';
import { request } from './api';

export interface RegisterPayload {
  fullName: string;
  username: string;
  email: string;
  password: string;
  university: string;
  department: string;
}

export const authService = {
  me: () => request<{ user: SelfUser }>({ url: '/auth/me' }).then((d) => d.user),
  login: (identifier: string, password: string) =>
    request<{ user: SelfUser }>({ method: 'POST', url: '/auth/login', data: { identifier, password } }).then(
      (d) => d.user,
    ),
  register: (data: RegisterPayload) =>
    request<{ user: SelfUser }>({ method: 'POST', url: '/auth/register', data }).then((d) => d.user),
  logout: () => request({ method: 'POST', url: '/auth/logout' }),
  verifyEmail: (token: string) =>
    request<{ user: SelfUser }>({ method: 'POST', url: '/auth/verify-email', data: { token } }).then(
      (d) => d.user,
    ),
  resendVerification: () => request({ method: 'POST', url: '/auth/resend-verification' }),
  forgotPassword: (email: string) =>
    request<{ message: string }>({ method: 'POST', url: '/auth/forgot-password', data: { email } }),
  resetPassword: (token: string, password: string) =>
    request<{ message: string }>({
      method: 'POST',
      url: '/auth/reset-password',
      data: { token, password },
    }),
};
