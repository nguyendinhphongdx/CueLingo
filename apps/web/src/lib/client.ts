import { ApiError, createClient } from '@cuelingo/core-sdk';
import {
  DeleteAccountRequestSchema,
  DebriefFeedbackRequestSchema,
  DebriefSchema,
  DeviceTokenListSchema,
  ErrorResponseSchema,
  ExportSchema,
  MeSchema,
  PhraseListSchema,
  PhraseSchema,
  ProgressSchema,
  ReviewAnswerRequestSchema,
  ReviewAnswerResponseSchema,
  ReviewQueueSchema,
  SavePhraseRequestSchema,
  SessionDetailSchema,
  SessionListSchema,
  DeleteMyDataRequestSchema,
  DeviceCodeResponseSchema,
  UpdateMeRequestSchema,
  type DeleteAccountRequest,
  type DeleteMyDataRequest,
  type DebriefFeedbackRequest,
  type ReviewAnswerRequest,
  type SavePhraseRequest,
  type UpdateMeRequest,
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
  me: {
    get: () => request('GET', '/v1/me', MeSchema),
    update: (input: UpdateMeRequest) =>
      request('PATCH', '/v1/me', MeSchema, UpdateMeRequestSchema.parse(input)),
    remove: (input: DeleteAccountRequest) =>
      request('DELETE', '/v1/me', null, DeleteAccountRequestSchema.parse(input)),
  },
  device: {
    /** A one-time code the desktop app trades for its own token. Needs the web session. */
    createCode: () => request('POST', '/v1/device/code', DeviceCodeResponseSchema),
    listTokens: () => request('GET', '/v1/device/tokens', DeviceTokenListSchema),
    revokeToken: (id: string) =>
      request('DELETE', `/v1/device/tokens/${encodeURIComponent(id)}`, null),
  },
  sessions: {
    list: () => request('GET', '/v1/sessions', SessionListSchema),
    get: (id: string) =>
      request('GET', `/v1/sessions/${encodeURIComponent(id)}`, SessionDetailSchema),
    getDebrief: (id: string) =>
      request('GET', `/v1/sessions/${encodeURIComponent(id)}/debrief`, DebriefSchema),
    remove: (id: string) => request('DELETE', `/v1/sessions/${encodeURIComponent(id)}`, null),
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
    list: () => request('GET', '/v1/phrases', PhraseListSchema),
    save: (input: SavePhraseRequest) =>
      request('POST', '/v1/phrases', PhraseSchema, SavePhraseRequestSchema.parse(input)),
    remove: (id: string) => request('DELETE', `/v1/phrases/${encodeURIComponent(id)}`, null),
  },
  review: {
    queue: () => request('GET', '/v1/review/queue', ReviewQueueSchema),
    answer: (input: ReviewAnswerRequest) =>
      request(
        'POST',
        '/v1/review/answer',
        ReviewAnswerResponseSchema,
        ReviewAnswerRequestSchema.parse(input),
      ),
  },
  progress: () => request('GET', '/v1/progress', ProgressSchema),
  privacy: {
    export: () => request('GET', '/v1/me/export', ExportSchema),
    deleteMyData: (input: DeleteMyDataRequest) =>
      request('DELETE', '/v1/me/data', null, DeleteMyDataRequestSchema.parse(input)),
  },
};
