import {
  AskMeetingRequestSchema,
  MeetingAskStreamEventSchema,
  MeetingAssistStatusSchema,
  type AskMeetingRequest,
  type MeetingAskStreamEvent,
  type MeetingAssistStatus,
} from '@cuelingo/shared';
import type { Http } from './http';
import { readEventStream, type EventStreamOptions } from './sse';

/** The assistant asked during a meeting (ADR 0027). */
export function meetingAssistApi(http: Http) {
  return {
    /** An older server has no such route and answers 404: treat that as "not available". */
    status(): Promise<MeetingAssistStatus> {
      return http.request('GET', '/v1/me/meeting-assist', MeetingAssistStatusSchema);
    },
    setConsent(granted: boolean): Promise<MeetingAssistStatus> {
      return http.request('PUT', '/v1/me/meeting-assist/consent', MeetingAssistStatusSchema, {
        granted,
      });
    },
    /**
     * One question over server-sent events. Refusals before the stream (403 consent, 404, 409 busy, 429 quota,
     * 503 off) throw `ApiError`. Aborting `signal` is the Stop button.
     */
    async ask(
      sessionId: string,
      body: AskMeetingRequest,
      options: EventStreamOptions<MeetingAskStreamEvent>,
    ): Promise<void> {
      const payload = AskMeetingRequestSchema.parse(body);
      await readEventStream(
        () =>
          http.stream('POST', `/v1/sessions/${encodeURIComponent(sessionId)}/questions`, payload, {
            signal: options.signal,
          }),
        MeetingAskStreamEventSchema,
        options,
      );
    },
  };
}
