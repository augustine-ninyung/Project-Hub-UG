import { NavLink, Route, Routes } from 'react-router-dom';
import { PageHeader } from '@/components/common/section';
import { AdminCategories, AdminProjects, AdminReports, AdminUsers } from '@/features/admin/management';
import { AdminOverview } from '@/features/admin/overview';
import { cn } from '@/utils/cn';

const TABS = [
  { to: '', label: 'Overview', end: true },
  { to: 'users', label: 'Students' },
  { to: 'projects', label: 'Projects' },
  { to: 'reports', label: 'Reports' },
  { to: 'categories', label: 'Categories' },
];

export default function AdminPage() {
  return (
    <div>
      <PageHeader title="Admin dashboard" description="Monitor the platform and keep the community healthy." />
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b [scrollbar-width:none]" aria-label="Admin sections">
        {TABS.map((t) => (
          <NavLink
            key={t.label}
            to={t.to ? `/admin/${t.to}` : '/admin'}
            end={t.end}
            className={({ isActive }) =>
              cn(
                '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
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
