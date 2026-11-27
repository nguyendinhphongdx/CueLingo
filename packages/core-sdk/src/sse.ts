import type { z } from 'zod';
import { ApiError } from './http';

/** One server-sent event: its `event:` name (default `message`) and the joined `data:` lines. */
export interface SseFrame {
  event: string;
  data: string;
}

/**
 * Incremental parser for `text/event-stream`. Feed it decoded text in any chunking: a chunk may end
 * mid-line, mid-frame or between the CR and LF of a CRLF. Comments and unknown fields are skipped.
 * A frame that never got its terminating blank line is dropped, as the SSE spec says.
 */
export function createSseParser(onFrame: (frame: SseFrame) => void) {
  let pending = '';
  let event = '';
  let data: string[] = [];

  function line(text: string) {
    if (text === '') {
      if (data.length > 0) onFrame({ event: event || 'message', data: data.join('\n') });
      event = '';
      data = [];
      return;
    }
    if (text.startsWith(':')) return;
    const colon = text.indexOf(':');
    const field = colon === -1 ? text : text.slice(0, colon);
    let value = colon === -1 ? '' : text.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }

  function drain(final: boolean) {
    // A lone CR at the very end may be the first half of CRLF: wait for the next chunk.
    const hold = !final && pending.endsWith('\r');
    const body = hold ? pending.slice(0, -1) : pending;
    const lines = body.replace(/\r\n?/g, '\n').split('\n');
    const rest = lines.pop() ?? '';
    for (const text of lines) line(text);
    pending = hold ? `${rest}\r` : rest;
  }

  return {
    push(chunk: string) {
      pending += chunk;
      drain(false);
    },
    /** The stream closed: process what is complete and drop a half-received frame. */
    end() {
      drain(true);
      pending = '';
      event = '';
      data = [];
    },
  };
}

export interface EventStreamOptions<Event> {
  signal?: AbortSignal;
  /** Called in order for every valid event. */
  onEvent: (event: Event) => void;
}

/**
 * Reads a streamed answer to its end. Events that do not match `schema` (a newer server, a broken frame) are
 * skipped. Aborting resolves quietly; a stream that ends without `done` throws `ApiError(0, 'NETWORK_ERROR')`.
 * `open` sends the request, so a refusal before the first byte arrives as the same `ApiError`.
 */
export async function readEventStream<S extends z.ZodType<{ type: string }>>(
  open: () => Promise<Response>,
  schema: S,
  { signal, onEvent }: EventStreamOptions<z.output<S>>,
): Promise<void> {
  let handlerFailed = false;
  try {
    const res = await open();
    if (!res.body) throw new ApiError(0, 'NETWORK_ERROR', 'The response has no body');

    let done = false;
    const parser = createSseParser((frame) => {
      let json: unknown;
      try {
        json = JSON.parse(frame.data);
      } catch {
        return;
      }
      const parsed = schema.safeParse(json);
      if (!parsed.success) return;
      const event = parsed.data as z.output<S>;
      if ((event as { type: string }).type === 'done') done = true;
      try {
        onEvent(event);
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
}
