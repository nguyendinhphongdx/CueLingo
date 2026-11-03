import {
  TranscribeResponseSchema,
  type TranscribeRequest,
  type TranscribeResponse,
} from '@cuelingo/shared';
import type { Http } from './http';

export function transcribeApi(http: Http) {
  return {
    /** Recognises one utterance of a cloud-recognised meeting (`POST /v1/sessions/:id/transcribe`). */
    transcribe(sessionId: string, input: TranscribeRequest): Promise<TranscribeResponse> {
      return http.request(
        'POST',
        `/v1/sessions/${encodeURIComponent(sessionId)}/transcribe`,
        TranscribeResponseSchema,
        input,
      );
    },
  };
}
