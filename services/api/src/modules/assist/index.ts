/**
 * Assist — contextual lookup, meeting recap and Vietnamese-to-English composing.
 * Design: apps/docs/docs/04-modules/03-api/assist.md
 */
import { assistRoutes } from './assist.routes';
import { createAssistService, type AssistDeps } from './assist.service';

export function createAssistModule(deps: AssistDeps) {
  const service = createAssistService(deps);
  return { service, routes: assistRoutes(service) };
}

export type { AssistDeps, AssistService } from './assist.service';
