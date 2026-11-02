import type { RealtimeClient, RealtimeClientOptions } from '@cuelingo/core-sdk';
import type { AudioModelEvent, SegmentEvent, TranscriptEvent } from '../lib/native';
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
  let onAudioModel: ((event: AudioModelEvent) => void) | undefined;
  let realtimeOptions: RealtimeClientOptions | undefined;
  const sent: unknown[] = [];
  const published: TranscriptEvent[] = [];
  const calls: string[] = [];
  const realtime: RealtimeClient = {
    connect: vi.fn(),
    send: (message) => sent.push(message),
    close: vi.fn(),
    get state(): RealtimeClient['state'] {
      return 'idle';
    },
  };
  const native = {
    sessionStart: vi.fn(async () => {
      calls.push('native.start');
      return { sessionId: 'local-native-session' };
    }),
    sessionStop: vi.fn().mockResolvedValue(undefined),
    onSegment: vi.fn(async (callback: (event: SegmentEvent) => void) => {
      onSegment = callback;
      return vi.fn();
    }),
    onAudioModel: vi.fn(async (callback: (event: AudioModelEvent) => void) => {
      onAudioModel = callback;
      return vi.fn();
    }),
    setLanguage: vi.fn(async () => undefined),
    publishTranscript: vi.fn(async (event: TranscriptEvent) => {
      published.push(event);
    }),
  };
  const sessions = {
    create: vi.fn(async (input: { assistLevel: number }) => {
      calls.push('api.create');
      return {
        id: sessionId,
        title: null,
        startedAt: '2026-11-03T00:00:00.000Z',
        endedAt: null,
        status: 'live' as const,
        assistLevel: input.assistLevel,
        language: 'en' as const,
      };
    }),
    setLanguage: vi.fn(async (_id: string, language: 'en' | 'ja') => ({
      id: sessionId,
      title: null,
      startedAt: '2026-11-03T00:00:00.000Z',
      endedAt: null,
      status: 'live' as const,
      assistLevel: 3,
      language,
    })),
    end: vi.fn(async () => ({
      id: sessionId,
      title: null,
      startedAt: '2026-11-03T00:00:00.000Z',
      endedAt: '2026-11-03T01:00:00.000Z',
      status: 'ended' as const,
      assistLevel: 3,
      language: 'en' as const,
    })),
  };
  const controller = createSessionController({
    native,
    sessions,
    createRealtime: (options) => {
      calls.push('realtime.create');
      realtimeOptions = options;
      return realtime;
    },
    apiUrl: 'ws://api.test/',
    token: 'dev-token',
    now: () => 1_000,
  });

  return {
    controller,
    native,
    sessions,
    realtime,
    calls,
    sent,
    published,
    emitSegment: (event: SegmentEvent) => onSegment?.(event),
    emitAudioModel: (event: AudioModelEvent) => onAudioModel?.(event),
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
      {
        segmentId,
        stream: 'system',
        text: 'Original text',
        translation: null,
        partial: true,
        language: 'en',
      },
      {
        segmentId,
        stream: 'mic',
        text: 'Original text',
        translation: null,
        partial: false,
        language: 'en',
      },
      {
        segmentId,
        stream: 'system',
        text: 'Original text',
        translation: null,
        partial: false,
        language: 'en',
      },
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
      stream: 'system',
      text: 'Original text',
      translation: 'Bản dịch',
      partial: false,
      language: 'en',
    });
  });

  it("publishes captions in the meeting's language", async () => {
    const context = setup();
    await context.controller.start(4, 'ja');
    context.emitSegment(segment());

    expect(context.published.at(-1)?.language).toBe('ja');
  });

  it('offers a language the native side heard, and switches everything when accepted', async () => {
    const context = setup();
    await context.controller.start(4, 'en');
    context.emitAudioModel({ type: 'language-suggestion', language: 'ja', confidence: 0.99 });
    expect(context.controller.getSnapshot().suggestedLanguage).toBe('ja');

    await context.controller.acceptSuggestedLanguage();

    expect(context.sessions.setLanguage).toHaveBeenCalledWith(sessionId, 'ja');
    expect(context.sent).toContainEqual({ type: 'language.set' });
    expect(context.native.setLanguage).toHaveBeenCalledWith('ja');
    expect(context.controller.getSnapshot().suggestedLanguage).toBeNull();
    context.emitSegment(segment());
    expect(context.published.at(-1)?.language).toBe('ja');
  });

  it('ignores a suggestion for the language already in use and lets one be dismissed', async () => {
    const context = setup();
    await context.controller.start(4, 'en');
    context.emitAudioModel({ type: 'language-suggestion', language: 'en', confidence: 0.99 });
    expect(context.controller.getSnapshot().suggestedLanguage).toBeNull();

    context.emitAudioModel({ type: 'language-suggestion', language: 'ja', confidence: 0.99 });
    context.controller.dismissSuggestedLanguage();
    expect(context.controller.getSnapshot().suggestedLanguage).toBeNull();
    expect(context.native.setLanguage).not.toHaveBeenCalled();
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

  it('creates the API session before starting native capture and opening realtime', async () => {
    const context = setup();

    await context.controller.start(4);

    expect(context.sessions.create).toHaveBeenCalledWith({ assistLevel: 4, language: 'en' });
    expect(context.calls).toEqual(['api.create', 'native.start', 'realtime.create']);
    expect(context.getRealtimeOptions()?.sessionId).toBe(sessionId);
  });

  it('creates the meeting in the language it was started with', async () => {
    const context = setup();

    await context.controller.start(3, 'en');

    expect(context.sessions.create).toHaveBeenCalledWith({ assistLevel: 3, language: 'en' });
  });

  it('does not start native capture or realtime when session creation fails', async () => {
    const context = setup();
    context.sessions.create.mockRejectedValueOnce(new Error('API unavailable'));

    await context.controller.start(3);

    expect(context.native.sessionStart).not.toHaveBeenCalled();
    expect(context.realtime.connect).not.toHaveBeenCalled();
    expect(context.controller.getSnapshot()).toMatchObject({
      status: 'error',
      error: new Error('API unavailable'),
    });
  });

  it('ends the API session once when stop is pressed twice', async () => {
    const context = setup();
    await context.controller.start(3);

    await Promise.all([context.controller.stop(), context.controller.stop()]);

    expect(context.native.sessionStop).toHaveBeenCalledOnce();
    expect(context.sessions.end).toHaveBeenCalledOnce();
    expect(context.sessions.end).toHaveBeenCalledWith(sessionId);
    expect(context.controller.getSnapshot()).toMatchObject({
      status: 'idle',
      completedSessionId: sessionId,
    });
  });

  it('still stops native capture and returns idle when ending the API session fails', async () => {
    const context = setup();
    await context.controller.start(3);
    context.sessions.end.mockRejectedValueOnce(new Error('API unavailable'));

    await context.controller.stop();

    expect(context.native.sessionStop).toHaveBeenCalledOnce();
    expect(context.controller.getSnapshot()).toMatchObject({
      status: 'idle',
      error: new Error('API unavailable'),
      completedSessionId: sessionId,
    });
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
