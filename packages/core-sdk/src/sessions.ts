import { DebriefQueuedSchema, type DebriefQueued } from '@cuelingo/shared';
import type { Http } from './http';

export function sessionsApi(http: Http) {
  return {
    /** Queues the debrief again for a finished meeting (`POST /v1/sessions/:id/debrief`, 202). */
    regenerateDebrief(sessionId: string): Promise<DebriefQueued> {
      return http.request(
        'POST',
        `/v1/sessions/${encodeURIComponent(sessionId)}/debrief`,
        DebriefQueuedSchema,
      );
    },
  };
}
