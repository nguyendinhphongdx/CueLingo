import { createClient } from '@cuelingo/core-sdk';
import { currentToken, resolveToken } from '../auth';
import { serverConfig } from '../server';
import { restUrl } from '../session/sessions-api';

/** The goal lesson calls of the shared client: goals, opening a lesson, practice, quiz, report. */
export const goalsApi = createClient({
  baseUrl: restUrl(serverConfig().apiUrl),
  getToken: () => resolveToken(currentToken),
}).goals;
