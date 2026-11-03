import {
  FollowupResponseSchema,
  type FollowupRequest,
  type FollowupResponse,
} from '@cuelingo/shared';
import type { Http } from './http';

export function followupApi(http: Http) {
  return {
    /** Drafts a follow-up message for a finished meeting (`POST /v1/sessions/:id/followup`). */
    followup(sessionId: string, input: FollowupRequest): Promise<FollowupResponse> {
      return http.request(
        'POST',
        `/v1/sessions/${encodeURIComponent(sessionId)}/followup`,
        FollowupResponseSchema,
        input,
      );
    },
  };
}
