import {
  AgentStreamEventSchema,
  SendMessageRequestSchema,
  type AgentStreamEvent,
  type SendMessageRequest,
} from '@cuelingo/shared';
import type { Http } from './http';
import { readEventStream } from './sse';

export interface SendMessageOptions {
  /** Aborting is the Stop button: the server keeps the text written so far and the call resolves quietly. */
  signal?: AbortSignal;
  /** Called in order for every valid event of the turn. */
  onEvent: (event: AgentStreamEvent) => void;
}

/**
 * One assistant turn over server-sent events. Problems before the stream starts (409 busy, 429 quota,
 * 503 off, 404, 401) throw `ApiError` with the server code and `details`. A stream that ends without
 * `done` throws `ApiError(0, 'NETWORK_ERROR')`. After `done`, refetch the conversation for stored messages.
 */
export function agentApi(http: Http) {
  return {
    async sendMessage(
      conversationId: string,
      body: SendMessageRequest,
      { signal, onEvent }: SendMessageOptions,
    ): Promise<void> {
      const payload = SendMessageRequestSchema.parse(body);
      await readEventStream(
        () =>
          http.stream(
            'POST',
            `/v1/conversations/${encodeURIComponent(conversationId)}/messages`,
            payload,
            { signal },
          ),
        AgentStreamEventSchema,
        { signal, onEvent },
      );
    },
  };
}
