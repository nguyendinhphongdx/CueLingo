import { currentToken, resolveToken, type TokenSource } from '../auth';
import { DebriefSchema, type Debrief } from '@cuelingo/shared';
import { restUrl } from './sessions-api';

type Fetch = typeof fetch;

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

export interface DebriefApi {
  /** The meeting's debrief, or null while it does not exist yet (404). */
  get(sessionId: string, signal?: AbortSignal): Promise<Debrief | null>;
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
  };
}

export const debriefApi = createDebriefApi({
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  token: currentToken,
});
