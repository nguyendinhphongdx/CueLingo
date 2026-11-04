import { RenameSpeakerResponseSchema, type Speaker } from '@cuelingo/shared';
import type { Http } from './http';

export function speakersApi(http: Http) {
  return {
    /** Names a person of a meeting; `null` removes the name (`PATCH /v1/sessions/:id/speakers/:speakerId`). */
    async renameSpeaker(
      sessionId: string,
      speakerId: string,
      displayName: string | null,
    ): Promise<Speaker> {
      const { speaker } = await http.request(
        'PATCH',
        `/v1/sessions/${encodeURIComponent(sessionId)}/speakers/${encodeURIComponent(speakerId)}`,
        RenameSpeakerResponseSchema,
        { displayName },
      );
      return speaker;
    },
  };
}
