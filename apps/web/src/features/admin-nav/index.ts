/**
 * The admin entry of the sidebar (group, active entry, "is this an admin"). A feature of its own, apart from
 * `features/admin`, so `AppShell` (every signed-in page) does not pull the admin pages and Recharts into its chunk.
 * Design: apps/docs/docs/04-modules/02-web/admin-console.md
 */
export { ADMIN_GROUP, adminActiveId, isAdminPath } from './admin-nav';
export { useIsAdmin } from './use-is-admin';
