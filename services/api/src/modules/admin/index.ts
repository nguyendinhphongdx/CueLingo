import { adminRoutes } from './admin.routes';
import { createAdminService } from './admin.service';
import type { AdminRepository } from './admin.repository';

export function createAdminModule(repo: AdminRepository, allowedEmails: readonly string[]) {
  const service = createAdminService(repo, allowedEmails);
  return { service, routes: adminRoutes(service) };
}

export type { AdminRepository } from './admin.repository';
export { createPostgresAdminRepository } from './admin.repository';
export { createInMemoryAdminRepository } from './admin.repository.memory';
