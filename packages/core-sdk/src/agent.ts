import {
  AgentStreamEventSchema,
  SendMessageRequestSchema,
  type AgentStreamEvent,
  type SendMessageRequest,
} from '@cuelingo/shared';
import { ApiError, type Http } from './http';
import { createSseParser } from './sse';

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
      let handlerFailed = false;
      try {
        const res = await http.stream(
          'POST',
          `/v1/conversations/${encodeURIComponent(conversationId)}/messages`,
          payload,
          { signal },
        );
        if (!res.body) throw new ApiError(0, 'NETWORK_ERROR', 'The response has no body');

        let done = false;
        const parser = createSseParser((frame) => {
          let json: unknown;
          try {
            json = JSON.parse(frame.data);
          } catch {
            return;
          }
          // Unknown event types (a newer server) and malformed frames are skipped, not fatal.
          const parsed = AgentStreamEventSchema.safeParse(json);
          if (!parsed.success) return;
          if (parsed.data.type === 'done') done = true;
          try {
            onEvent(parsed.data);
          } catch (err) {
            handlerFailed = true;
            throw err;
          }
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        try {
          for (;;) {
            const { value, done: finished } = await reader.read();
            if (finished) break;
            parser.push(decoder.decode(value, { stream: true }));
          }
          parser.push(decoder.decode());
          parser.end();
        } finally {
          await reader.cancel().catch(() => undefined);
        }
        if (!done) throw new ApiError(0, 'NETWORK_ERROR', 'The stream ended before it was done');
      } catch (err) {
        if (signal?.aborted) return;
        if (handlerFailed) throw err;
        if (err instanceof ApiError) throw err;
        throw new ApiError(0, 'NETWORK_ERROR', (err as Error).message);
      }
    },
  };
}
