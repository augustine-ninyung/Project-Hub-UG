import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { SESSION_EXPIRED_EVENT } from '@/services/api';
import { authService, type RegisterPayload } from '@/services/auth.service';
import type { SelfUser } from '@/types/api';

export const AUTH_QUERY_KEY = ['auth', 'me'] as const;

interface AuthContextValue {
  user: SelfUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (identifier: string, password: string, cancelDeletion?: boolean) => Promise<SelfUser>;
  register: (data: RegisterPayload) => Promise<SelfUser>;
  logout: () => Promise<void>;
  setUser: (user: SelfUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The session lives in httpOnly cookies; the client only knows who is signed
 * in by asking the API. The current user is cached in TanStack Query.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      try {
        return await authService.me();
      } catch {
        return null;
      }
    },
    staleTime: Infinity,
    retry: false,
  });

  const setUser = useCallback(
    (next: SelfUser | null) => queryClient.setQueryData(AUTH_QUERY_KEY, next),
    [queryClient],
  );

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [setUser]);

  const login = useCallback(
    async (identifier: string, password: string, cancelDeletion = false) => {
      const u = await authService.login(identifier, password, cancelDeletion);
      // Personalised data (likedByMe, recommendations) must be refetched.
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
      setUser(u);
      return u;
    },
    [queryClient, setUser],
  );

  const register = useCallback(
    async (data: RegisterPayload) => {
      const u = await authService.register(data);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
      setUser(u);
      return u;
    },
    [queryClient, setUser],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Sign out locally regardless; the server session expires on its own.
    }
    // Update the auth entry in place: clear() would remove it from the cache
    // and detach the observer above, leaving the old user on screen.
    await queryClient.cancelQueries();
    setUser(null);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
  }, [queryClient, setUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ?? null,
      isLoading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'ADMIN',
      login,
      register,
      logout,
      setUser,
    }),
    [user, isLoading, login, register, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
