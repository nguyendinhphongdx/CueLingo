import { FeedbackSchema, type CreateFeedbackRequest, type Feedback } from '@cuelingo/shared';
import type { Http } from './http';

export function feedbackApi(http: Http) {
  return {
    /** Sends a bug report or idea (`POST /v1/feedback`); the server rejects any field beyond the schema. */
    send(input: CreateFeedbackRequest): Promise<Feedback> {
      return http.request('POST', '/v1/feedback', FeedbackSchema, input);
    },
  };
}
