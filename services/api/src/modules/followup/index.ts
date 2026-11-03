/**
 * Followup — Drafts a follow-up message (email or group chat) from a meeting's debrief; stores nothing.
 * Design: apps/docs/docs/04-modules/03-api/followup.md
 */
import type { DebriefRepository } from '../debrief';
import type { SessionsRepository } from '../sessions';
import { followupRoutes } from './followup.routes';
import { createFollowupService, type FollowupDeps } from './followup.service';

export function createFollowupModule(
  sessions: Pick<SessionsRepository, 'findById'>,
  debriefs: Pick<DebriefRepository, 'findLatest'>,
  deps: FollowupDeps,
) {
  const service = createFollowupService(sessions, debriefs, deps);
  return { service, routes: followupRoutes(service) };
}

export type { FollowupDeps, FollowupService } from './followup.service';
