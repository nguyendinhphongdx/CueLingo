import type { NavGroup } from '@cuelingo/ui/components/sidebar-nav';

/**
 * The "Quản trị" group of the sidebar, in the order it is listed. Only the web has it (the pages exist only
 * here), and `AppShell` passes it only once `GET /v1/admin/me` has said the caller is an admin.
 */
export const ADMIN_GROUP: NavGroup = {
  id: 'admin',
  title: 'Quản trị',
  items: [
    { id: 'admin-overview', label: 'Tổng quan', icon: 'dashboard', webPath: '/admin' },
    { id: 'admin-users', label: 'Người dùng & gói', icon: 'users', webPath: '/admin/users' },
    { id: 'admin-revenue', label: 'Doanh thu', icon: 'revenue', webPath: '/admin/revenue' },
    { id: 'admin-usage', label: 'Lượng dùng', icon: 'usage', webPath: '/admin/usage' },
    { id: 'admin-activity', label: 'Hoạt động app', icon: 'activity', webPath: '/admin/metrics' },
    { id: 'admin-agent', label: 'Trợ lý AI', icon: 'assistant', webPath: '/admin/agent' },
    { id: 'admin-invites', label: 'Mã mời', icon: 'invites', webPath: '/admin/invites' },
  ],
};

export const isAdminPath = (pathname: string | null) =>
  pathname === '/admin' || Boolean(pathname?.startsWith('/admin/'));

/**
 * The entry for a path. `/admin` matches only itself (every admin page starts with it); the others match
 * themselves and the pages under them (`/admin/users/<id>` belongs to Người dùng & gói).
 */
export function adminActiveId(pathname: string | null): string {
  if (!pathname) return '';
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/admin') return 'admin-overview';
  return (
    ADMIN_GROUP.items.find(
      (item) =>
        item.webPath !== '/admin' && (path === item.webPath || path.startsWith(`${item.webPath}/`)),
    )?.id ?? ''
  );
}
