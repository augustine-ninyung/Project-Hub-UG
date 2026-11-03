import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { PageLoader } from '@/components/common/states';
import { AppLayout } from '@/layouts/app-layout';
import { AuthLayout } from '@/layouts/auth-layout';
import { GuestOnly, RequireAdmin, RequireAuth } from './guards';

// Route-level code splitting keeps the initial bundle small.
const HomePage = lazy(() => import('@/pages/home-page'));
const ExplorePage = lazy(() => import('@/pages/explore-page'));
const ProjectDetailPage = lazy(() => import('@/pages/project-detail-page'));
const NewProjectPage = lazy(() => import('@/pages/new-project-page'));
const EditProjectPage = lazy(() => import('@/pages/edit-project-page'));
const ProfilePage = lazy(() => import('@/pages/profile-page'));
const SettingsPage = lazy(() => import('@/pages/settings-page'));
const NotificationsPage = lazy(() => import('@/pages/notifications-page'));
const AdminPage = lazy(() => import('@/pages/admin-page'));
const LoginPage = lazy(() => import('@/pages/auth/login-page'));
const RegisterPage = lazy(() => import('@/pages/auth/register-page'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/forgot-password-page'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/reset-password-page'));
const VerifyEmailPage = lazy(() => import('@/pages/auth/verify-email-page'));
const NotFoundPage = lazy(() => import('@/pages/not-found-page'));

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="explore" element={<ExplorePage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="u/:username" element={<ProfilePage />} />
          <Route
            path="projects/new"
            element={
              <RequireAuth>
                <NewProjectPage />
              </RequireAuth>
            }
          />
          <Route
            path="projects/:id/edit"
            element={
              <RequireAuth>
                <EditProjectPage />
              </RequireAuth>
            }
          />
          <Route
            path="settings"
            element={
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="notifications"
            element={
              <RequireAuth>
                <NotificationsPage />
              </RequireAuth>
            }
          />
          <Route
            path="admin/*"
            element={
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route element={<AuthLayout />}>
          <Route
            path="login"
            element={
              <GuestOnly>
                <LoginPage />
              </GuestOnly>
            }
          />
          <Route
            path="register"
            element={
              <GuestOnly>
                <RegisterPage />
              </GuestOnly>
            }
          />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
