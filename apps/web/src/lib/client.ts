import { createClient } from '@cuelingo/core-sdk';
import { API_URL } from './config';

/**
 * The single API client for the web app. Features import it; they never call fetch.
 * Auth is the Better Auth session cookie, so there is no token to read; 'include' sends it cross-origin.
 */
export const client = createClient({
  baseUrl: API_URL,
  getToken: () => null,
  credentials: 'include',
});
