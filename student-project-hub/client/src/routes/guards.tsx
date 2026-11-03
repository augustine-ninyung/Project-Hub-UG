import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { PageLoader } from '@/components/common/states';
import { useAuth } from '@/context/auth-context';

/** Redirects anonymous users to /login, remembering where they were going. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

/**
 * Hides admin pages from non-admins. This is only a UX convenience: every
 * admin endpoint is independently authorised by the server.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

/** Login/register pages redirect signed-in users home. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}
