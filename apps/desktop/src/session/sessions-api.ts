import { currentToken, resolveToken, type TokenSource } from '../auth';
import {
  CreateSessionRequestSchema,
  SessionListSchema,
  SessionSchema,
  type CreateSessionRequest,
  type SessionList,
  type Session,
} from '@cuelingo/shared';

type Fetch = typeof fetch;

export interface SessionsApi {
  create(input: CreateSessionRequest): Promise<Session>;
  end(sessionId: string): Promise<Session>;
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
