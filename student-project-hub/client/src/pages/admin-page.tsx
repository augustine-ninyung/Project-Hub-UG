import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink, Route, Routes } from 'react-router-dom';
import { PageHeader } from '@/components/common/section';
import { useAuth } from '@/context/auth-context';
import { AdminCategories, AdminProjects, AdminReports, AdminUsers } from '@/features/admin/management';
import { AdminOverview } from '@/features/admin/overview';
import { useLiveTopic } from '@/hooks/use-live-topic';
import { adminService } from '@/services/admin.service';
import { cn } from '@/utils/cn';

export default function AdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const stats = useQuery({ queryKey: ['admin', 'statistics'], queryFn: adminService.statistics });
  const t = stats.data?.totals;

  // Live dashboard: sign-ups, reports and other admins' actions arrive on the
  // admin topic. Likes, comments and project changes come through LiveFeed
  // (app layout), which refreshes admin queries too.
  useLiveTopic(user?.adminTopic, () => {
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
    void queryClient.invalidateQueries({ queryKey: ['categories'] });
  });

  const tabs = [
    { to: '/admin', label: 'Overview', end: true },
    { to: '/admin/users', label: 'Students', count: t?.unverifiedUsers, hint: 'unverified' },
    { to: '/admin/projects', label: 'Projects' },
    { to: '/admin/reports', label: 'Reports', count: t?.pendingReports, hint: 'pending', urgent: true },
    { to: '/admin/categories', label: 'Categories' },
  ];

  return (
    <div>
      <PageHeader title="Admin dashboard" description="Monitor the platform and keep the community healthy." />
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b [scrollbar-width:none]" aria-label="Admin sections">
        {tabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-200',
                isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )
            }
          >
            {tab.label}
            {!!tab.count && (
              <span
                key={tab.count}
                className={cn(
                  'min-w-5 animate-pop rounded-full px-1.5 py-px text-center text-[11px] font-semibold tabular-nums',
                  tab.urgent ? 'bg-destructive text-white' : 'bg-warning/20 text-warning',
                )}
                aria-label={`${tab.count} ${tab.hint}`}
                title={`${tab.count} ${tab.hint}`}
              >
                {tab.count}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      {/* Tab changes animate through the app layout's page transition. */}
      <Routes>
        <Route index element={<AdminOverview />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="projects" element={<AdminProjects />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="categories" element={<AdminCategories />} />
      </Routes>
    </div>
  );
}
