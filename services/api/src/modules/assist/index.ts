/**
 * Assist — contextual lookup, meeting recap and Vietnamese-to-English composing.
 * Design: apps/docs/docs/04-modules/03-api/assist.md
 */
import type { UsageService } from '../usage';
import { assistRoutes } from './assist.routes';
import { createAssistService, type AssistDeps } from './assist.service';

/**
 * `usage` counts the HTTP endpoints only (daily allowance, AC8). `service` stays uncounted because the
 * assistant's own `lookup` tool calls it and has its own quota.
 */
export function createAssistModule(deps: AssistDeps, usage: Pick<UsageService, 'reserve'>) {
  const service = createAssistService(deps);
  const gate = async (userId: string) => {
    await usage.reserve(userId, 'assist_daily');
  };
  return { service, routes: assistRoutes(service, gate) };
}

export type { AssistDeps, AssistService } from './assist.service';
