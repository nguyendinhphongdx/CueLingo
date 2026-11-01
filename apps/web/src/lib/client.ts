import { ApiError, createClient } from '@cuelingo/core-sdk';
import {
  DebriefFeedbackRequestSchema,
  DebriefSchema,
  ErrorResponseSchema,
  PhraseSchema,
  SavePhraseRequestSchema,
  SessionDetailSchema,
  SessionListSchema,
  type DebriefFeedbackRequest,
  type SavePhraseRequest,
} from '@cuelingo/shared';
import { API_URL } from './config';

/**
 * The single API client for the web app. Features import it; they never call fetch.
 * Auth is the Better Auth session cookie, so there is no token to read; 'include' sends it cross-origin.
 */
const coreClient = createClient({
  baseUrl: API_URL,
  getToken: () => null,
  credentials: 'include',
});

interface ResponseSchema<T> {
  parse(input: unknown): T;
}

async function request<T>(
  method: string,
  path: string,
  schema: ResponseSchema<T>,
  body?: unknown,
): Promise<T>;
async function request(method: string, path: string, schema: null, body?: unknown): Promise<void>;
async function request<T>(
  method: string,
  path: string,
  schema: ResponseSchema<T> | null,
  body?: unknown,
): Promise<T | void> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new ApiError(0, 'NETWORK_ERROR', (error as Error).message);
  }

  if (!response.ok) {
    const parsed = ErrorResponseSchema.safeParse(await response.json().catch(() => null));
    if (parsed.success) {
      throw new ApiError(
        response.status,
        parsed.data.error.code,
        parsed.data.error.message,
        parsed.data.error.details,
      );
    }
    throw new ApiError(response.status, 'INTERNAL_ERROR', `HTTP ${response.status}`);
  }

  return schema ? schema.parse(await response.json()) : undefined;
}

/** Web endpoints that are not yet part of core-sdk still stay behind this single client boundary. */
export const client = {
  ...coreClient,
  sessions: {
    list: () => request('GET', '/v1/sessions', SessionListSchema),
    get: (id: string) =>
      request('GET', `/v1/sessions/${encodeURIComponent(id)}`, SessionDetailSchema),
    getDebrief: (id: string) =>
      request('GET', `/v1/sessions/${encodeURIComponent(id)}/debrief`, DebriefSchema),
  },
  debriefs: {
    feedback: (id: string, input: DebriefFeedbackRequest) =>
      request(
        'POST',
        `/v1/debriefs/${encodeURIComponent(id)}/feedback`,
        null,
        DebriefFeedbackRequestSchema.parse(input),
      ),
  },
  phrases: {
    save: (input: SavePhraseRequest) =>
      request('POST', '/v1/phrases', PhraseSchema, SavePhraseRequestSchema.parse(input)),
  },
};
