import { describe, expect, it } from 'vitest';
import { createSseParser, type SseFrame } from './sse';

function parse(chunks: string[]): SseFrame[] {
  const frames: SseFrame[] = [];
  const parser = createSseParser((f) => frames.push(f));
  for (const chunk of chunks) parser.push(chunk);
  parser.end();
  return frames;
}

const wire = 'event: status\ndata: {"a":1}\n\nevent: done\ndata: {"b":2}\n\n';

describe('createSseParser', () => {
  it('parses whole frames', () => {
    expect(parse([wire])).toEqual([
      { event: 'status', data: '{"a":1}' },
      { event: 'done', data: '{"b":2}' },
    ]);
  });

  it('gives the same frames for every way of splitting the stream', () => {
    const whole = parse([wire]);
    for (let i = 1; i < wire.length; i++) {
      expect(parse([wire.slice(0, i), wire.slice(i)])).toEqual(whole);
    }
    expect(parse([...wire])).toEqual(whole);
  });

  it('accepts CRLF and lone CR, also when split between CR and LF', () => {
    const crlf = wire.replace(/\n/g, '\r\n');
    const whole = parse([wire]);
    expect(parse([crlf])).toEqual(whole);
    expect(parse([...crlf])).toEqual(whole);
    expect(parse([wire.replace(/\n/g, '\r')])).toEqual(whole);
  });

  it('skips comments and unknown fields, joins multi-line data, defaults the event name', () => {
    expect(parse([': ping\n\nid: 7\nretry: 5\ndata: a\ndata:b\n\n'])).toEqual([
      { event: 'message', data: 'a\nb' },
    ]);
  });

  it('drops a frame that never ended', () => {
    expect(parse(['event: done\ndata: {}\n'])).toEqual([]);
  });
});
