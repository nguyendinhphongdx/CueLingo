/** Privacy — user-scoped data deletion and export. */
import { privacyRoutes } from './privacy.routes';
import { createPrivacyService } from './privacy.service';
import type { PrivacyRepository } from './privacy.repository';

export function createPrivacyModule(repo: PrivacyRepository) {
  const service = createPrivacyService(repo);
  return { service, routes: privacyRoutes(service) };
}

export type { PrivacyRepository } from './privacy.repository';
export type { PrivacyService } from './privacy.service';
export { createPostgresPrivacyRepository } from './privacy.repository';
