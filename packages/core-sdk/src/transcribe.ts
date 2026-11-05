import {
  TranscribeRequestSchema,
  TranscribeResponseSchema,
  type TranscribeRequest,
  type TranscribeResponse,
} from '@cuelingo/shared';
import { ApiError, type Http } from './http';

/** Two models at 7 s each on the server, plus a little for the network. */
export const TRANSCRIBE_TIMEOUT_MS = 16_000;

export interface TranscribeOptions {
  /** Cancels the request (a newer utterance replaced it, or the meeting ended). */
  signal?: AbortSignal;
  timeoutMs?: number;
}

export function transcribeApi(http: Http) {
  return {
    /**
     * Recognises one utterance of a cloud-recognised meeting (`POST /v1/sessions/:id/transcribe`).
     * A request that never reached the server fails with an `ApiError` of status 0 whose message
     * is fixed text: nothing in it may echo the audio or the text.
     */
    async transcribe(
      sessionId: string,
      input: TranscribeRequest,
      { signal, timeoutMs = TRANSCRIBE_TIMEOUT_MS }: TranscribeOptions = {},
    ): Promise<TranscribeResponse> {
      const body = TranscribeRequestSchema.parse(input);
      const abort = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        abort.abort();
      }, timeoutMs);
      const onCallerAbort = () => abort.abort();
      if (signal?.aborted) abort.abort();
      else signal?.addEventListener('abort', onCallerAbort, { once: true });
      try {
        return await http.request(
          'POST',
          `/v1/sessions/${encodeURIComponent(sessionId)}/transcribe`,
          TranscribeResponseSchema,
          body,
          { signal: abort.signal },
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 0) {
          throw new ApiError(
            0,
            'NETWORK_ERROR',
            timedOut
              ? 'Transcribe request timed out'
              : abort.signal.aborted
                ? 'Transcribe request aborted'
                : 'Transcribe request failed',
          );
        }
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onCallerAbort);
      }
    },
  };
}
