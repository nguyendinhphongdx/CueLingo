/**
 * sessions.close-stale — every 10 minutes, ends live meetings abandoned for 30 minutes and queues their debrief.
 * Design: apps/docs/docs/04-modules/04-workers/README.md
 */
import { JobName } from '@cuelingo/shared';
import { defineJob } from '../types';
import { STALE_SWEEP_CRON, closeStaleSessions } from './stale-sessions.handler';

export const sessionsCloseStale = defineJob({
  name: JobName.SessionsCloseStale,
  schedule: STALE_SWEEP_CRON,
  handle: async (deps) => {
    await closeStaleSessions(deps);
  },
});

export {
  STALE_SESSION_MINUTES,
  STALE_SWEEP_CRON,
  closeStaleSessions,
} from './stale-sessions.handler';
export {
  createPostgresStaleSessionsRepository,
  type ClosedSession,
  type StaleSessionsRepository,
} from './stale-sessions.repository';
