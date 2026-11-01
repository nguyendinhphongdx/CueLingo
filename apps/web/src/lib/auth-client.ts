import { magicLinkClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { API_URL } from './config';

/** Better Auth client: sign in, sign out, and the current session (cookie lives on the API origin). */
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [magicLinkClient()],
});
