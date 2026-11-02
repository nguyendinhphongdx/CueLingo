import { AssistSuggestionSchema, type AssistSuggestion } from '@cuelingo/shared';
import { currentToken, resolveToken, type TokenSource } from '../auth';

export interface DialApi {
  suggestion(): Promise<AssistSuggestion>;
}

export function createDialApi({
  apiUrl,
  token,
  fetch: request = fetch,
}: {
  apiUrl: string;
  token: TokenSource;
  fetch?: typeof fetch;
}): DialApi {
  const baseUrl = apiUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:').replace(/\/$/, '');
  return {
    async suggestion() {
      const response = await request(`${baseUrl}/v1/me/assist-suggestion`, {
        headers: { Authorization: `Bearer ${resolveToken(token)}` },
      });
      if (!response.ok) throw new Error(`Suggestion request failed with status ${response.status}`);
      return AssistSuggestionSchema.parse(await response.json());
    },
  };
}

export const dialApi = createDialApi({
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  token: currentToken,
});
