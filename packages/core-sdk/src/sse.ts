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
