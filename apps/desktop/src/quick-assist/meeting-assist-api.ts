import { createClient } from '@cuelingo/core-sdk';
import { currentToken, resolveToken } from '../auth';
import { serverConfig } from '../server';
import { restUrl } from '../session/sessions-api';

/** The meeting assistant calls of the shared client: availability, consent and one streamed question. */
export const meetingAssistApi = createClient({
  baseUrl: restUrl(serverConfig().apiUrl),
  getToken: () => resolveToken(currentToken),
}).meetingAssist;

export type MeetingAssistApi = typeof meetingAssistApi;
