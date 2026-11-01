import {
  ComposeRequestSchema,
  ComposeResponseSchema,
  LookupRequestSchema,
  LookupResponseSchema,
  PostEventsRequestSchema,
  RecapRequestSchema,
  RecapResponseSchema,
  type ComposeRequest,
  type LearningEvent,
  type LookupRequest,
  type RecapRequest,
} from '@cuelingo/shared';
import { currentToken, resolveToken, type TokenSource } from '../auth';
import type { z } from 'zod';

type Fetch = typeof fetch;

export interface AssistApi {
  lookup(input: LookupRequest): Promise<z.infer<typeof LookupResponseSchema>>;
  recap(input: RecapRequest): Promise<z.infer<typeof RecapResponseSchema>>;
  compose(input: ComposeRequest): Promise<z.infer<typeof ComposeResponseSchema>>;
  record(event: LearningEvent): Promise<void>;
}

interface AssistApiOptions {
  apiUrl: string;
  token: TokenSource;
  fetch?: Fetch;
}

function restUrl(apiUrl: string) {
  return apiUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:').replace(/\/$/, '');
}

export function createAssistApi({ apiUrl, token, fetch: request = fetch }: AssistApiOptions) {
  const baseUrl = restUrl(apiUrl);
  const headers = {
    get Authorization() {
      return `Bearer ${resolveToken(token)}`;
    },
    'Content-Type': 'application/json',
  };

  async function post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
    const response = await request(`${baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`Assist request failed with status ${response.status}`);
    return schema.parse(await response.json());
  }

  return {
    lookup: (input: LookupRequest) =>
      post('/v1/assist/lookup', LookupRequestSchema.parse(input), LookupResponseSchema),
    recap: (input: RecapRequest) =>
      post('/v1/assist/recap', RecapRequestSchema.parse(input), RecapResponseSchema),
    compose: (input: ComposeRequest) =>
      post('/v1/assist/compose', ComposeRequestSchema.parse(input), ComposeResponseSchema),
    async record(event: LearningEvent) {
      const body = PostEventsRequestSchema.parse({ events: [event] });
      const response = await request(`${baseUrl}/v1/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`Event request failed with status ${response.status}`);
    },
  } satisfies AssistApi;
}

export const assistApi = createAssistApi({
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  token: currentToken,
});
