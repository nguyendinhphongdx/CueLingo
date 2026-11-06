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
  PlacementResultSchema,
  PlacementTestSchema,
  SubmitPlacementRequestSchema,
  PhraseSchema,
  ProgressSchema,
  ReviewAnswerRequestSchema,
  ReviewAnswerResponseSchema,
  ReviewQueueSchema,
  SavePhraseRequestSchema,
  SessionDetailSchema,
  SessionListSchema,
  AssistSuggestionSchema,
  LookupRequestSchema,
  LookupResponseSchema,
  type LookupRequest,
  PostEventsRequestSchema,
  type LearningEvent,
  TtsRequestSchema,
  DeleteMyDataRequestSchema,
  AdminAgentStatusSchema,
  AdminMetricsSchema,
  CreateInviteRequestSchema,
  CreatedInviteSchema,
  InviteIntentRequestSchema,
  InviteListSchema,
  type CreateInviteInput,
  DeviceCodeResponseSchema,
  UpdateAdminAgentRequestSchema,
  UpdateMeRequestSchema,
  UpdateUserSettingsSchema,
  UserSettingsSchema,
  type DeleteAccountRequest,
  type LanguageCode,
  type DeleteMyDataRequest,
  type DebriefFeedbackRequest,
  type ReviewAnswerRequest,
  type SavePhraseRequest,
  type SubmitPlacementRequest,
  type UpdateAdminAgentRequest,
  type UpdateMeRequest,
  type UpdateUserSettings,
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
/** Spoken audio for a short English text, as a blob the page can play. */
async function speak(text: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/v1/tts`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(TtsRequestSchema.parse({ text })),
    });
  } catch (error) {
    throw new ApiError(0, 'NETWORK_ERROR', (error as Error).message);
  }
  if (!response.ok) throw new ApiError(response.status, 'TTS_FAILED', `HTTP ${response.status}`);
  return response.blob();
}

export const client = {
  ...coreClient,
  tts: { speak },
  assist: {
    /** Meaning of a word in its sentence (also what the assistant's lookup tool uses). */
    lookup: (input: LookupRequest) =>
      request('POST', '/v1/assist/lookup', LookupResponseSchema, LookupRequestSchema.parse(input)),
    /** Whether to offer a different assist level; the server decides from recent meetings. */
    suggestion: (language: LanguageCode) =>
      request('GET', `/v1/me/assist-suggestion?language=${language}`, AssistSuggestionSchema),
  },
  events: {
    record: (event: LearningEvent) =>
      request('POST', '/v1/events', null, PostEventsRequestSchema.parse({ events: [event] })),
  },
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
    list: (language: LanguageCode) =>
      request('GET', `/v1/phrases?language=${language}`, PhraseListSchema),
    save: (input: SavePhraseRequest) =>
      request('POST', '/v1/phrases', PhraseSchema, SavePhraseRequestSchema.parse(input)),
    remove: (id: string) => request('DELETE', `/v1/phrases/${encodeURIComponent(id)}`, null),
  },
  review: {
    // `dictation=1`: this client can play and grade listen-and-type cards.
    queue: (language: LanguageCode) =>
      request('GET', `/v1/review/queue?dictation=1&language=${language}`, ReviewQueueSchema),
    answer: (input: ReviewAnswerRequest) =>
      request(
        'POST',
        '/v1/review/answer',
        ReviewAnswerResponseSchema,
        ReviewAnswerRequestSchema.parse(input),
      ),
  },
  placement: {
    get: (language: LanguageCode) =>
      request('GET', `/v1/placement?language=${language}`, PlacementTestSchema),
    submit: (input: SubmitPlacementRequest) =>
      request(
        'POST',
        '/v1/placement',
        PlacementResultSchema,
        SubmitPlacementRequestSchema.parse(input),
      ),
  },
  progress: (language: LanguageCode) =>
    request('GET', `/v1/progress?language=${language}`, ProgressSchema),
  admin: {
    metrics: () => request('GET', '/v1/admin/metrics', AdminMetricsSchema),
    agent: {
      get: () => request('GET', '/v1/admin/agent', AdminAgentStatusSchema),
      update: (input: UpdateAdminAgentRequest) =>
        request(
          'PATCH',
          '/v1/admin/agent',
          AdminAgentStatusSchema,
          UpdateAdminAgentRequestSchema.parse(input),
        ),
    },
    invites: {
      list: () => request('GET', '/v1/admin/invites', InviteListSchema),
      create: (input: CreateInviteInput) =>
        request(
          'POST',
          '/v1/admin/invites',
          CreatedInviteSchema,
          CreateInviteRequestSchema.parse(input),
        ),
      revoke: (id: string) => request('DELETE', `/v1/admin/invites/${id}`, null),
    },
  },
  /** Asks the API to remember a typed invite code for the sign-in that follows (sets an httpOnly cookie). */
  invites: {
    intent: (code: string) =>
      request('POST', '/v1/invites/intent', null, InviteIntentRequestSchema.parse({ code })),
  },
  privacy: {
    export: () => request('GET', '/v1/me/export', ExportSchema),
    deleteMyData: (input: DeleteMyDataRequest) =>
      request('DELETE', '/v1/me/data', null, DeleteMyDataRequestSchema.parse(input)),
  },
  settings: {
    get: (language: LanguageCode) =>
      request('GET', `/v1/me/settings?language=${language}`, UserSettingsSchema),
    /** The assist default is saved for `language`; overlay settings are the person's whatever the language. */
    update: (input: UpdateUserSettings, language: LanguageCode) =>
      request(
        'PATCH',
        `/v1/me/settings?language=${language}`,
        UserSettingsSchema,
        UpdateUserSettingsSchema.parse(input),
      ),
  },
};
