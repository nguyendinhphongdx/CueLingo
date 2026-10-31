import { createClient } from '@cuelingo/core-sdk';

/** The single API client for the web app. Features import it; they never call fetch. */
export const client = createClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  // TODO(auth module, apps/docs/docs/04-modules/03-api/auth.md): read the session token.
  getToken: () => null,
});
