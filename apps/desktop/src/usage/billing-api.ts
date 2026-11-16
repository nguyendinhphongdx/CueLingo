import { createClient } from '@cuelingo/core-sdk';
import { currentToken, resolveToken } from '../auth';
import { serverConfig } from '../server';
import { restUrl } from '../session/sessions-api';

const billing = createClient({
  baseUrl: restUrl(serverConfig().apiUrl),
  getToken: () => resolveToken(currentToken),
}).billing;

/**
 * `GET /v1/billing` through the shared client: the plan in force with its end date, and whether payments are on.
 * Desktop never creates orders: paying happens on the web (the "Nâng gói" button opens it).
 */
export const billingApi = { overview: () => billing.overview() };
