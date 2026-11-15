import { createClient } from '@cuelingo/core-sdk';
import { currentToken, resolveToken } from '../auth';
import { serverConfig } from '../server';
import { restUrl } from '../session/sessions-api';

/** `GET /v1/me/usage` through the shared client: the person's plan and every allowance. */
export const usageApi = createClient({
  baseUrl: restUrl(serverConfig().apiUrl),
  getToken: () => resolveToken(currentToken),
}).usage;
