/**
 * Admin users module — dashboard, people with their plans, change a plan (spec 2026-11-15-admin-users-plans).
 * Design: apps/docs/docs/04-modules/03-api/admin-users.md
 */
import { adminUsersRoutes } from './admin-users.routes';
import { createAdminUsersService, type AdminUsersOptions } from './admin-users.service';
import type { AdminUsersRepository } from './admin-users.repository';

export function createAdminUsersModule(repo: AdminUsersRepository, options: AdminUsersOptions) {
  const service = createAdminUsersService(repo, options);
  return { service, routes: adminUsersRoutes(service) };
}

export type { AdminUsersRepository } from './admin-users.repository';
export type { AdminUsersService } from './admin-users.service';
export { createPostgresAdminUsersRepository } from './admin-users.repository';
export {
  createInMemoryAdminUsersRepository,
  type InMemoryAdminUser,
  type InMemoryPaidOrder,
} from './admin-users.repository.memory';
