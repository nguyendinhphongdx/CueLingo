import { adminRoutes } from './admin.routes';
import { createAdminService } from './admin.service';
import type { AdminRepository } from './admin.repository';
import type { AgentAdminPort } from './admin.service';

export function createAdminModule(
  repo: AdminRepository,
  allowedEmails: readonly string[],
  agent?: () => AgentAdminPort | undefined,
) {
  const service = createAdminService(repo, allowedEmails, agent);
  return { service, routes: adminRoutes(service) };
}

export type { AdminRepository } from './admin.repository';
export { createPostgresAdminRepository } from './admin.repository';
export { createInMemoryAdminRepository } from './admin.repository.memory';
export type { AgentAdminPort } from './admin.service';
