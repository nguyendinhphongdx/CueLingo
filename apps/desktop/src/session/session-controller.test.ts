import type { RealtimeClient, RealtimeClientOptions } from '@cuelingo/core-sdk';
import type { SegmentEvent, TranscriptEvent } from '../lib/native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionController } from './session-controller';

const sessionId = '6df65d24-949f-4456-b5d2-4394c9d7ae16';
const segmentId = 'eb3fc1d4-c8b7-4a22-a842-873be0f9a9de';

function segment(overrides: Partial<SegmentEvent> = {}): SegmentEvent {
  return {
    segmentId,
    stream: 'system',
    startMs: 100,
    endMs: 500,
    text: 'Original text',
    words: [],
    partial: false,
    ...overrides,
  };
}

function setup() {
  let onSegment: ((event: SegmentEvent) => void) | undefined;
  let realtimeOptions: RealtimeClientOptions | undefined;
  const sent: unknown[] = [];
  const published: TranscriptEvent[] = [];
  const realtime: RealtimeClient = {
    connect: vi.fn(),
    send: (message) => sent.push(message),
    close: vi.fn(),
    get state(): RealtimeClient['state'] {
      return 'idle';
    },
  };
  const native = {
    sessionStart: vi.fn().mockResolvedValue({ sessionId: 'local-native-session' }),
    sessionStop: vi.fn().mockResolvedValue(undefined),
    onSegment: vi.fn(async (callback: (event: SegmentEvent) => void) => {
      onSegment = callback;
      return vi.fn();
    }),
    publishTranscript: vi.fn(async (event: TranscriptEvent) => {
      published.push(event);
    }),
  };
  const controller = createSessionController({
    native,
    createRealtime: (options) => {
      realtimeOptions = options;
      return realtime;
    },
    apiUrl: 'ws://api.test/',
    token: 'dev-token',
    now: () => 1_000,
    createSessionId: () => sessionId,
  });

  return {
    controller,
    native,
    realtime,
    sent,
    published,
    emitSegment: (event: SegmentEvent) => onSegment?.(event),
    getRealtimeOptions: () => realtimeOptions,
  };
}

describe('session controller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('publishes every segment immediately and sends only final system segments', async () => {
    const context = setup();
    await context.controller.start(3);

    context.emitSegment(segment({ partial: true }));
    context.emitSegment(segment({ stream: 'mic' }));
    context.emitSegment(segment());

    expect(context.published).toEqual([
      { segmentId, text: 'Original text', translation: null, partial: true },
      { segmentId, text: 'Original text', translation: null, partial: false },
      { segmentId, text: 'Original text', translation: null, partial: false },
    ]);
    expect(context.sent).toEqual([
      {
        type: 'segment.final',
        segmentId,
        stream: 'system',
        startMs: 100,
        endMs: 500,
        text: 'Original text',
        words: [],
      },
    ]);
  });

  it('publishes translations with the matching original segment id', async () => {
    const context = setup();
    await context.controller.start(4);
    context.emitSegment(segment());

    context.getRealtimeOptions()?.onMessage({
      type: 'translation',
      segmentId,
      textVi: 'Bản dịch',
      hardWords: [],
    });

    expect(context.published.at(-1)).toEqual({
      segmentId,
      text: 'Original text',
      translation: 'Bản dịch',
      partial: false,
    });
  });

  it('maps realtime states and configures the session websocket', async () => {
    const context = setup();
    await context.controller.start(3);
    const options = context.getRealtimeOptions();

    expect(options?.url).toBe(`ws://api.test/v1/sessions/${sessionId}/stream`);
    expect(options?.token).toBe('dev-token');
    expect(context.controller.getSnapshot().status).toBe('connecting');
    options?.onState('open');
    expect(context.controller.getSnapshot().status).toBe('running');
    options?.onState('reconnecting');
    expect(context.controller.getSnapshot().status).toBe('reconnecting');
    options?.onError(new Error('offline'));
    expect(context.controller.getSnapshot().status).toBe('error');
  });

  it('emits six demo segments 1.5 seconds apart through transcript publishing', () => {
    const context = setup();
    context.controller.runDemo();

    expect(context.published).toHaveLength(0);
    vi.advanceTimersByTime(0);
    expect(context.published).toHaveLength(1);
    for (let index = 2; index <= 6; index += 1) {
      vi.advanceTimersByTime(1_500);
      expect(context.published).toHaveLength(index);
    }
    expect(context.published.map(({ partial }) => partial)).toEqual([
      true,
      false,
      true,
      false,
      true,
      false,
    ]);
  });
});
