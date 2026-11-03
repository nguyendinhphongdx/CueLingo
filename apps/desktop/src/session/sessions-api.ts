import { currentToken, resolveToken, type TokenSource } from '../auth';
import {
  CreateSessionRequestSchema,
  SessionListSchema,
  SessionSchema,
  TranscribeRequestSchema,
  TranscribeResponseSchema,
  type TranscribeRequest,
  type TranscribeResponse,
  type CreateSessionRequest,
  type LanguageCode,
  type SessionList,
  type Session,
} from '@cuelingo/shared';

type Fetch = typeof fetch;

// Two models at 7 s each on the server, plus a little for the network.
const TRANSCRIBE_TIMEOUT_MS = 16_000;

/** Why a recognition request failed; the message never holds audio or text. */
export class TranscribeError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'TranscribeError';
  }
}

export interface SessionsApi {
  create(input: CreateSessionRequest): Promise<Session>;
  end(sessionId: string): Promise<Session>;
  /** The speakers changed language part-way; the server keeps the meeting's language in step. */
  setLanguage(sessionId: string, language: LanguageCode): Promise<Session>;
  /** Recognises one utterance in the cloud (ADR 0014); the audio is never kept or logged. */
  transcribe(
    sessionId: string,
    input: TranscribeRequest,
    signal?: AbortSignal,
  ): Promise<TranscribeResponse>;
  list(): Promise<SessionList>;
  remove(sessionId: string): Promise<void>;
}

interface SessionsApiOptions {
  apiUrl: string;
  token: TokenSource;
  fetch?: Fetch;
}

function restUrl(apiUrl: string) {
  return apiUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:').replace(/\/$/, '');
}

export function createSessionsApi({ apiUrl, token, fetch: request = fetch }: SessionsApiOptions) {
  const baseUrl = restUrl(apiUrl);
  const headers = {
    get Authorization() {
      return `Bearer ${resolveToken(token)}`;
    },
    'Content-Type': 'application/json',
  };

  async function post(path: string, body?: unknown): Promise<Session> {
    const response = await request(`${baseUrl}${path}`, {
      method: 'POST',
      headers,
      // The API parses JSON bodies, so a request with a JSON content type must carry one.
      body: JSON.stringify(body ?? {}),
    });

    if (!response.ok) throw new Error(`Session request failed with status ${response.status}`);
    return SessionSchema.parse(await response.json());
  }

  return {
    create: (input: CreateSessionRequest) =>
      post('/v1/sessions', CreateSessionRequestSchema.parse(input)),
    end: (sessionId: string) => post(`/v1/sessions/${sessionId}/end`),
    async setLanguage(sessionId, language) {
      const response = await request(`${baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ language }),
      });
      if (!response.ok) throw new Error(`Session request failed with status ${response.status}`);
      return SessionSchema.parse(await response.json());
    },
    async transcribe(sessionId, input, signal?: AbortSignal) {
      const body = JSON.stringify(TranscribeRequestSchema.parse(input));
      const abort = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        abort.abort();
      }, TRANSCRIBE_TIMEOUT_MS);
      const onCallerAbort = () => abort.abort();
      if (signal?.aborted) abort.abort();
      else signal?.addEventListener('abort', onCallerAbort, { once: true });
      let response: Response;
      try {
        response = await request(
          `${baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/transcribe`,
          { method: 'POST', headers, body, signal: abort.signal },
        );
      } catch {
        // The original error is dropped on purpose: nothing in the message may echo the request.
        throw new TranscribeError(
          timedOut
            ? 'Transcribe request timed out'
            : abort.signal.aborted
              ? 'Transcribe request aborted'
              : 'Transcribe request failed',
        );
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onCallerAbort);
      }
      if (!response.ok) {
        throw new TranscribeError(
          `Transcribe request failed with status ${response.status}`,
          response.status,
        );
      }
      return TranscribeResponseSchema.parse(await response.json());
    },
    async list() {
      const response = await request(`${baseUrl}/v1/sessions`, { headers });
      if (!response.ok) throw new Error(`Session request failed with status ${response.status}`);
      return SessionListSchema.parse(await response.json());
    },
    async remove(sessionId: string) {
      const response = await request(`${baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) throw new Error(`Session request failed with status ${response.status}`);
    },
  } satisfies SessionsApi;
}

export const sessionsApi = createSessionsApi({
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  token: currentToken,
});
