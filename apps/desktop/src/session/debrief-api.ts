import { currentToken, resolveToken, type TokenSource } from '../auth';
import {
  DebriefSchema,
  FollowupRequestSchema,
  FollowupResponseSchema,
  type Debrief,
  type FollowupRequest,
  type FollowupResponse,
} from '@cuelingo/shared';
import { restUrl } from './sessions-api';

type Fetch = typeof fetch;

export const FOLLOWUP_TIMEOUT_MS = 20_000;

/** The debrief request failed; `status` is the HTTP status when there was a response. */
export class DebriefError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'DebriefError';
  }
}

/** What the person reads when a follow-up draft fails; never includes any draft or server text. */
export function describeFollowupError(error: unknown): string {
  const status = error instanceof DebriefError ? error.status : undefined;
  if (status === 401 || status === 403) return 'Hãy đăng nhập lại để soạn follow-up.';
  if (status === 429) return 'Bạn soạn hơi nhanh, đợi một lát rồi thử lại.';
  if (status === 404) return 'Debrief chưa sẵn sàng.';
  return 'Không soạn được bản nháp. Hãy thử lại.';
}

export interface DebriefApi {
  /** The meeting's debrief, or null while it does not exist yet (404). */
  get(sessionId: string, signal?: AbortSignal): Promise<Debrief | null>;
  /** A drafted follow-up message for the meeting; gives up after 20 s. Errors never carry the draft. */
  followup(sessionId: string, input: FollowupRequest): Promise<FollowupResponse>;
}

interface DebriefApiOptions {
  apiUrl: string;
  token: TokenSource;
  fetch?: Fetch;
}

export function createDebriefApi({
  apiUrl,
  token,
  fetch: request = fetch,
}: DebriefApiOptions): DebriefApi {
  const baseUrl = restUrl(apiUrl);
  return {
    async get(sessionId, signal) {
      const response = await request(
        `${baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/debrief`,
        { headers: { Authorization: `Bearer ${resolveToken(token)}` }, signal },
      );
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new DebriefError(
          `Debrief request failed with status ${response.status}`,
          response.status,
        );
      }
      return DebriefSchema.parse(await response.json());
    },
    async followup(sessionId, input) {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), FOLLOWUP_TIMEOUT_MS);
      try {
        const response = await request(
          `${baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/followup`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resolveToken(token)}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(FollowupRequestSchema.parse(input)),
            signal: abort.signal,
          },
        );
        if (!response.ok) {
          throw new DebriefError(
            `Follow-up request failed with status ${response.status}`,
            response.status,
          );
        }
        return FollowupResponseSchema.parse(await response.json());
      } catch (error) {
        if (error instanceof DebriefError) throw error;
        // Network failure, timeout or a malformed body: say which, never echo content.
        throw new DebriefError(
          abort.signal.aborted ? 'Follow-up request timed out' : 'Follow-up request failed',
        );
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export const debriefApi = createDebriefApi({
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  token: currentToken,
});
