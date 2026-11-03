import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/context/auth-context';
import type { SelfUser } from '@/types/api';

export const testUser: SelfUser = {
  id: 'u1',
  email: 'ama@example.edu',
  username: 'ama',
  fullName: 'Ama Mensah',
  avatarUrl: null,
  university: 'University of Ghana',
  department: 'Computer Science',
  bio: null,
  skills: [],
  githubUrl: null,
  linkedinUrl: null,
  portfolioUrl: null,
  role: 'STUDENT',
  emailVerified: true,
  createdAt: new Date().toISOString(),
};

/** Renders inside QueryClient + router + auth, with the session pre-seeded. */
export function renderWithProviders(
  ui: ReactElement,
  { user = testUser as SelfUser | null, route = '/', path = '*' } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(['auth', 'me'], user);
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>
            <Routes>
              <Route path={path} element={ui} />
              <Route path="/login" element={<p>Login page</p>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}
