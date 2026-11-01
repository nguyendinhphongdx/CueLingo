import { currentToken, resolveToken, type TokenSource } from '../auth';
import {
  DeleteMyDataRequestSchema,
  ExportSchema,
  type DeleteMyDataRequest,
  type Export,
} from '@cuelingo/shared';

type Fetch = typeof fetch;

export interface PrivacyApi {
  exportData(): Promise<Export>;
  deleteMyData(input: DeleteMyDataRequest): Promise<void>;
}

export function createPrivacyApi({
  apiUrl,
  token,
  fetch: request = fetch,
}: {
  apiUrl: string;
  token: TokenSource;
  fetch?: Fetch;
}): PrivacyApi {
  const baseUrl = apiUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:').replace(/\/$/, '');
  const authorization = {
    get Authorization() {
      return `Bearer ${resolveToken(token)}`;
    },
  };
  return {
    async exportData() {
      const response = await request(`${baseUrl}/v1/me/export`, { headers: authorization });
      if (!response.ok) throw new Error(`Privacy request failed with status ${response.status}`);
      return ExportSchema.parse(await response.json());
    },
    async deleteMyData(input) {
      const response = await request(`${baseUrl}/v1/me/data`, {
        method: 'DELETE',
        headers: { ...authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify(DeleteMyDataRequestSchema.parse(input)),
      });
      if (!response.ok) throw new Error(`Privacy request failed with status ${response.status}`);
    },
  };
}

export const privacyApi = createPrivacyApi({
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  token: currentToken,
});
