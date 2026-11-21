import { createClient } from '@cuelingo/core-sdk';
import { currentToken, resolveToken } from '../auth';
import { serverConfig } from '../server';
import { restUrl } from '../session/sessions-api';

/** The learning-path calls of the shared client: courses, starting one, its cards, meeting preparation. */
export const coursesApi = createClient({
  baseUrl: restUrl(serverConfig().apiUrl),
  getToken: () => resolveToken(currentToken),
}).courses;
