import {
  PhraseListSchema,
  PhraseSchema,
  ReviewAnswerRequestSchema,
  ReviewAnswerResponseSchema,
  ReviewQueueSchema,
  type ReviewAnswerRequest,
  TtsRequestSchema,
  DEFAULT_LANGUAGE,
  type LanguageCode,
} from '@cuelingo/shared';
import { currentToken, resolveToken, type TokenSource } from '../auth';
import type { z } from 'zod';

type Fetch = typeof fetch;

export interface StudyApi {
  getReviewQueue(language?: LanguageCode): Promise<z.infer<typeof ReviewQueueSchema>>;
  answerReview(input: ReviewAnswerRequest): Promise<z.infer<typeof ReviewAnswerResponseSchema>>;
  getPhrases(language?: LanguageCode): Promise<z.infer<typeof PhraseListSchema>>;
  removePhrase(id: string): Promise<void>;
  /** Spoken audio for a short English text. */
  speak(text: string): Promise<Blob>;
}

interface StudyApiOptions {
  apiUrl: string;
  token: TokenSource;
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
    get Authorization() {
      return `Bearer ${resolveToken(token)}`;
    },
    'Content-Type': 'application/json',
  };

  async function get<T>(path: string, schema: z.ZodType<T>) {
    const response = await request(`${baseUrl}${path}`, { headers });
    if (!response.ok) throw new Error(`Study request failed with status ${response.status}`);
    return schema.parse(await response.json());
  }

  return {
    // `dictation=1`: this client can play and grade listen-and-type cards.
    getReviewQueue: (language = DEFAULT_LANGUAGE) =>
      get(`/v1/review/queue?dictation=1&language=${language}`, ReviewQueueSchema),
    async speak(text) {
      const response = await request(`${baseUrl}/v1/tts`, {
        method: 'POST',
        headers,
        body: JSON.stringify(TtsRequestSchema.parse({ text })),
      });
      if (!response.ok) throw new Error(`Speech request failed with status ${response.status}`);
      return response.blob();
    },
    async answerReview(input) {
      const response = await request(`${baseUrl}/v1/review/answer`, {
        method: 'POST',
        headers,
        body: JSON.stringify(ReviewAnswerRequestSchema.parse(input)),
      });
      if (!response.ok) throw new Error(`Study request failed with status ${response.status}`);
      return ReviewAnswerResponseSchema.parse(await response.json());
    },
    getPhrases: (language = DEFAULT_LANGUAGE) =>
      get(`/v1/phrases?language=${language}`, PhraseListSchema),
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
  token: currentToken,
});
