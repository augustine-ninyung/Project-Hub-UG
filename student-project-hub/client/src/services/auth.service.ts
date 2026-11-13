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
  /** `cancelDeletion` withdraws a pending account-deletion request while signing in. */
  login: (identifier: string, password: string, cancelDeletion = false) =>
    request<{ user: SelfUser }>({
      method: 'POST',
      url: '/auth/login',
      data: { identifier, password, ...(cancelDeletion ? { cancelDeletion } : {}) },
    }).then((d) => d.user),
  /** Creates the account; the student signs in after confirming their email. */
  register: (data: RegisterPayload) =>
    request<{ email: string }>({ method: 'POST', url: '/auth/register', data }),
  logout: () => request({ method: 'POST', url: '/auth/logout' }),
  verifyEmail: (token: string) =>
    request<{ user: SelfUser }>({ method: 'POST', url: '/auth/verify-email', data: { token } }).then(
      (d) => d.user,
    ),
  /** Email or username. The answer is the same whether or not the account exists. */
  resendVerification: (identifier: string) =>
    request({ method: 'POST', url: '/auth/resend-verification', data: { identifier } }),
  forgotPassword: (email: string) =>
    request<{ message: string }>({ method: 'POST', url: '/auth/forgot-password', data: { email } }),
  resetPassword: (token: string, password: string) =>
    request<{ message: string }>({
      method: 'POST',
      url: '/auth/reset-password',
      data: { token, password },
    }),
};
