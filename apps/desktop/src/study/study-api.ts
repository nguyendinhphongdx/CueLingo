import {
  PhraseListSchema,
  PhraseSchema,
  ReviewAnswerRequestSchema,
  ReviewAnswerResponseSchema,
  ReviewQueueSchema,
  type ReviewAnswerRequest,
} from '@cuelingo/shared';
import type { z } from 'zod';

type Fetch = typeof fetch;

export interface StudyApi {
  getReviewQueue(): Promise<z.infer<typeof ReviewQueueSchema>>;
  answerReview(input: ReviewAnswerRequest): Promise<z.infer<typeof ReviewAnswerResponseSchema>>;
  getPhrases(): Promise<z.infer<typeof PhraseListSchema>>;
  removePhrase(id: string): Promise<void>;
}

interface StudyApiOptions {
  apiUrl: string;
  token: string;
  fetch?: Fetch;
}

function restUrl(apiUrl: string) {
  return apiUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:').replace(/\/$/, '');
}

export function createStudyApi({
  apiUrl,
  token,
  fetch: request = fetch,
}: StudyApiOptions): StudyApi {
  const baseUrl = restUrl(apiUrl);
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  async function get<T>(path: string, schema: z.ZodType<T>) {
    const response = await request(`${baseUrl}${path}`, { headers });
    if (!response.ok) throw new Error(`Study request failed with status ${response.status}`);
    return schema.parse(await response.json());
  }

  return {
    getReviewQueue: () => get('/v1/review/queue', ReviewQueueSchema),
    async answerReview(input) {
      const response = await request(`${baseUrl}/v1/review/answer`, {
        method: 'POST',
        headers,
        body: JSON.stringify(ReviewAnswerRequestSchema.parse(input)),
      });
      if (!response.ok) throw new Error(`Study request failed with status ${response.status}`);
      return ReviewAnswerResponseSchema.parse(await response.json());
    },
    getPhrases: () => get('/v1/phrases', PhraseListSchema),
    async removePhrase(id) {
      const phraseId = PhraseSchema.shape.id.parse(id);
      const response = await request(`${baseUrl}/v1/phrases/${encodeURIComponent(phraseId)}`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) throw new Error(`Study request failed with status ${response.status}`);
    },
  };
}

export const studyApi = createStudyApi({
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  token: import.meta.env.VITE_REALTIME_TOKEN || 'dev-token',
});
