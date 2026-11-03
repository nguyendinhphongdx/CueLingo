import { JobName, debriefJobOptions } from '@cuelingo/shared';
import type { JobDeps } from '../types';

/** A live meeting with no new segment for this long is treated as abandoned (app crashed or closed). */
export const STALE_SESSION_MINUTES = 30;
/** How often the sweep runs (cron, UTC). */
export const STALE_SWEEP_CRON = '*/10 * * * *';
const BATCH_SIZE = 200;
const MINUTE_MS = 60 * 1000;

/**
 * Ends abandoned live sessions and queues their debrief, as POST /v1/sessions/:id/end does.
 * Idempotent: only rows still 'live' are closed, so a repeat run enqueues nothing twice, and
 * the debrief job carries the same dedupe key the API uses.
 */
export async function closeStaleSessions(deps: Pick<JobDeps, 'staleSessions' | 'queue' | 'now'>) {
  const cutoff = new Date(deps.now().getTime() - STALE_SESSION_MINUTES * MINUTE_MS);
  let closed = 0;
  let queued = 0;

  for (;;) {
    const batch = await deps.staleSessions.closeStaleLive(cutoff, BATCH_SIZE);
    for (const session of batch) {
      if (session.segmentCount === 0) continue; // nothing to summarise
      await deps.queue.enqueue(
        JobName.DebriefGenerate,
        { sessionId: session.id },
        debriefJobOptions(session.id),
      );
      queued += 1;
    }
    closed += batch.length;
    if (batch.length < BATCH_SIZE) return { closed, queued };
  }
}
