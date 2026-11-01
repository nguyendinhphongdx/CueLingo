import type { ClientMessage } from '@cuelingo/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRealtimeClient, type RealtimeSocket, type RealtimeState } from './realtime';

const sessionId = '9ee72a14-8cd4-4f2e-8131-4ed638e2d875';
const segmentId = 'c67ef96d-7890-49a7-9a55-66c49272e38f';

class FakeSocket implements RealtimeSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  close = vi.fn();

  send(data: string) {
    this.sent.push(data);
  }

  open() {
    this.onopen?.();
  }

  receive(message: unknown) {
    this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) });
  }

  disconnect() {
    this.onclose?.();
  }
}

function segment(text: string): ClientMessage {
  return {
    type: 'segment.final',
    segmentId,
    stream: 'system',
    startMs: 0,
    endMs: 100,
    text,
    words: [],
  };
}

function setup() {
  const sockets: FakeSocket[] = [];
  const states: RealtimeState[] = [];
  const onMessage = vi.fn();
  const onError = vi.fn();
  const client = createRealtimeClient({
    url: 'wss://api.example.test/v1/sessions/session/stream',
    token: 'access-token',
    sessionId,
    assistLevel: 3,
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    onMessage,
    onState: (state) => states.push(state),
    onError,
  });
  return { client, sockets, states, onMessage, onError };
}

describe('createRealtimeClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends hello on connection and opens only after ready', () => {
    const { client, sockets, states, onMessage } = setup();

    client.connect();
    expect(client.state).toBe('connecting');
    expect(states).toEqual(['connecting']);

    sockets[0]?.open();
    expect(sockets[0]?.sent.map((message) => JSON.parse(message))).toEqual([
      { type: 'hello', sessionId, token: 'access-token', sttSource: 'local', assistLevel: 3 },
    ]);
    expect(client.state).toBe('connecting');

    sockets[0]?.receive({ type: 'ready', sessionId });
    expect(client.state).toBe('open');
    expect(states).toEqual(['connecting', 'open']);
    expect(onMessage).toHaveBeenCalledWith({ type: 'ready', sessionId });
  });

  it('drops buffered messages older than 60 seconds and flushes the rest in order', () => {
    const { client, sockets } = setup();
    client.send(segment('expired'));
    vi.advanceTimersByTime(60_001);
    client.send(segment('first'));
    client.send({ type: 'event' });

    client.connect();
    sockets[0]?.open();
    sockets[0]?.receive({ type: 'ready', sessionId });

    expect(sockets[0]?.sent.map((message) => JSON.parse(message))).toEqual([
      { type: 'hello', sessionId, token: 'access-token', sttSource: 'local', assistLevel: 3 },
      segment('first'),
      { type: 'event' },
    ]);
  });

  it('reconnects with capped backoff and sends hello on every attempt until closed', () => {
    const { client, sockets, states } = setup();
    client.connect();
    sockets[0]?.open();

    const delays = [500, 1_000, 2_000, 4_000, 8_000, 8_000];
    for (const [index, delay] of delays.entries()) {
      sockets[index]?.disconnect();
      expect(client.state).toBe('reconnecting');
      vi.advanceTimersByTime(delay - 1);
      expect(sockets).toHaveLength(index + 1);
      vi.advanceTimersByTime(1);
      expect(sockets).toHaveLength(index + 2);
      sockets[index + 1]?.open();
    }

    for (const socket of sockets) {
      expect(socket.sent.map((message) => JSON.parse(message))[0]).toEqual({
        type: 'hello',
        sessionId,
        token: 'access-token',
        sttSource: 'local',
        assistLevel: 3,
      });
    }
    expect(states[0]).toBe('connecting');
    expect(states).toContain('reconnecting');

    sockets.at(-1)?.disconnect();
    client.close();
    vi.advanceTimersByTime(8_000);
    expect(sockets).toHaveLength(delays.length + 1);
    expect(client.state).toBe('closed');
  });

  it('resets reconnect backoff after a ready message', () => {
    const { client, sockets } = setup();
    client.connect();
    sockets[0]?.disconnect();
    vi.advanceTimersByTime(500);
    sockets[1]?.open();
    sockets[1]?.receive({ type: 'ready', sessionId });
    sockets[1]?.disconnect();

    vi.advanceTimersByTime(499);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
  });

  it('ignores malformed server messages and reports parsing errors', () => {
    const { client, sockets, onMessage, onError } = setup();
    client.connect();
    sockets[0]?.open();

    sockets[0]?.receive('{not-json');
    sockets[0]?.receive({ type: 'translation', segmentId, textVi: 'Xin chào' });
    sockets[0]?.receive({
      type: 'translation',
      segmentId,
      textVi: 'Xin chào',
      hardWords: [],
    });

    expect(onError).toHaveBeenCalledTimes(2);
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith({
      type: 'translation',
      segmentId,
      textVi: 'Xin chào',
      hardWords: [],
    });
  });
});
