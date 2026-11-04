import type {
  GlossaryTerm,
  LanguageCode,
  TranscribeRequest,
  TranscribeResponse,
} from '@cuelingo/shared';
import type { RealtimeClient, RealtimeClientOptions } from '@cuelingo/core-sdk';
import type {
  AudioModelEvent,
  AudioStatusEvent,
  SegmentEvent,
  SessionStartInput,
  TranscriptEvent,
  UtteranceEvent,
} from '../lib/native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SUPPORTED_LANGUAGES } from '@cuelingo/shared';
import { createSessionController } from './session-controller';
import { TranscribeError } from './sessions-api';

/** Every language the registry recognises in the cloud. */
const cloudCodes = (Object.keys(SUPPORTED_LANGUAGES) as LanguageCode[]).filter(
  (code) => SUPPORTED_LANGUAGES[code].recognition === 'cloud',
);

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

function term(text: string, createdAt = '2026-11-01T00:00:00.000Z'): GlossaryTerm {
  return {
    id: crypto.randomUUID(),
    term: text,
    translation: null,
    note: null,
    createdAt,
    language: 'en',
  };
}

type GlossaryList = (language: LanguageCode) => Promise<GlossaryTerm[]>;

type Transcribe = (
  sessionId: string,
  input: TranscribeRequest,
  signal?: AbortSignal,
) => Promise<TranscribeResponse>;

function setup(
  glossaryList?: GlossaryList,
  options: { transcribe?: Transcribe; consent?: boolean; now?: () => number } = {},
) {
  let onUtterance: ((event: UtteranceEvent) => void) | undefined;
  const unlistenUtterance = vi.fn();
  const unlistenStatus = vi.fn();
  let onStatus: ((event: AudioStatusEvent) => void) | undefined;
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
    sessionStart: vi.fn(async (_input: SessionStartInput) => {
      calls.push('native.start');
      return { sessionId: 'local-native-session' };
    }),
    sessionStop: vi.fn().mockResolvedValue(undefined),
    hideOverlay: vi.fn().mockResolvedValue(undefined),
    onSegment: vi.fn(async (callback: (event: SegmentEvent) => void) => {
      onSegment = callback;
      return vi.fn();
    }),
    onUtterance: vi.fn(async (callback: (event: UtteranceEvent) => void) => {
      onUtterance = callback;
      return unlistenUtterance;
    }),
    onAudioModel: vi.fn(async (callback: (event: AudioModelEvent) => void) => {
      onAudioModel = callback;
      return vi.fn();
    }),
    onAudioStatus: vi.fn(async (callback: (event: AudioStatusEvent) => void) => {
      onStatus = callback;
      return unlistenStatus;
    }),
    setLanguage: vi.fn(async () => undefined),
    setVocabulary: vi.fn(async () => undefined),
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
    transcribe: vi.fn<Transcribe>(
      options.transcribe ??
        (async (_id, input) => ({ segmentId: input.segmentId, text: 'xin chào' })),
    ),
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
    hasCloudConsent: () => options.consent ?? true,
    glossary: glossaryList ? { list: glossaryList } : undefined,
    createRealtime: (options) => {
      calls.push('realtime.create');
      realtimeOptions = options;
      return realtime;
    },
    apiUrl: 'ws://api.test/',
    token: 'dev-token',
    now: options.now ?? (() => 1_000),
  });

  return {
    controller,
    native,
    sessions,
    realtime,
    calls,
    sent,
    published,
    emitUtterance: (event: UtteranceEvent) => onUtterance?.(event),
    unlistenUtterance,
    emitSegment: (event: SegmentEvent) => onSegment?.(event),
    emitStatus: (event: AudioStatusEvent) => onStatus?.(event),
    unlistenStatus,
    emitAudioModel: (event: AudioModelEvent) => onAudioModel?.(event),
    getRealtimeOptions: () => realtimeOptions,
  };
}

describe('session controller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // Both final streams go to the server as text so the English transcript has "Tôi" (AC1); partials never do.
  it('publishes every segment immediately and sends the final segments of both streams', async () => {
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
        stream: 'mic',
        startMs: 100,
        endMs: 500,
        text: 'Original text',
        words: [],
      },
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

  it('gives the English path no speaker labels and sends no knownSpeakers (AC7)', async () => {
    const context = setup();
    await context.controller.start(3);
    context.emitSegment(segment());
    expect(context.published.every((event) => event.speaker === undefined)).toBe(true);
    expect(context.sent.every((message) => !('speaker' in (message as object)))).toBe(true);
    expect(context.sessions.transcribe).not.toHaveBeenCalled();
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

  it('hides the overlay once, after the session ended, and not again on a second stop', async () => {
    const context = setup();
    await context.controller.start(3);
    const order: string[] = [];
    context.sessions.end.mockImplementationOnce(async () => {
      order.push('end');
      return {} as never;
    });
    context.native.hideOverlay.mockImplementation(async () => {
      order.push('hide');
    });

    await Promise.all([context.controller.stop(), context.controller.stop()]);

    expect(context.native.hideOverlay).toHaveBeenCalledOnce();
    expect(order).toEqual(['end', 'hide']);
  });

  it('hides the overlay after the drain of a cloud meeting, not before', async () => {
    const context = setup();
    await context.controller.start(3, 'vi');
    const stopping = context.controller.stop();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(context.native.hideOverlay).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    await stopping;
    expect(context.native.hideOverlay).toHaveBeenCalledOnce();
  });

  it('hides the overlay when the start fails, and swallows a failing hide', async () => {
    const context = setup();
    context.native.sessionStart.mockRejectedValueOnce(new Error('no permission'));
    context.native.hideOverlay.mockRejectedValueOnce(new Error('gone'));
    await context.controller.start(3);
    expect(context.native.hideOverlay).toHaveBeenCalledOnce();
    expect(context.controller.getSnapshot().status).toBe('error');
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

  describe('a start that fails part-way', () => {
    it('stops the native session and ends the server one, so the next start works', async () => {
      const ctx = setup();
      const real = ctx.realtime;
      // The factory is fixed in setup; make connect throw once instead.
      (real.connect as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw new Error('connect failed');
      });
      await ctx.controller.start(3, 'en');

      expect(ctx.native.sessionStop).toHaveBeenCalledOnce();
      expect(ctx.sessions.end).toHaveBeenCalledOnce();
      expect(ctx.sessions.end).toHaveBeenCalledWith(sessionId);
      expect(ctx.controller.getSnapshot()).toMatchObject({
        status: 'error',
        meetingLanguage: null,
      });

      await ctx.controller.start(3, 'en');
      expect(ctx.native.sessionStart).toHaveBeenCalledTimes(2);
      expect(ctx.controller.getSnapshot().error).toBeNull();
    });

    it('does not stop native when it never started, but still ends the server session', async () => {
      const ctx = setup();
      ctx.native.onAudioStatus.mockRejectedValueOnce(new Error('listen failed'));
      await ctx.controller.start(3, 'en');
      expect(ctx.native.sessionStop).not.toHaveBeenCalled();
      expect(ctx.sessions.end).toHaveBeenCalledWith(sessionId);
      expect(ctx.controller.getSnapshot().status).toBe('error');
    });

    it('survives a native stop that fails during cleanup', async () => {
      const ctx = setup();
      (ctx.realtime.connect as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw new Error('boom');
      });
      ctx.native.sessionStop.mockRejectedValueOnce(new Error('already gone'));
      ctx.sessions.end.mockRejectedValueOnce(new Error('api down'));
      await ctx.controller.start(3, 'en');
      expect(ctx.controller.getSnapshot().status).toBe('error');
    });
  });

  describe('a meeting that ended in error while capturing', () => {
    it('is closed before the next one starts', async () => {
      const ctx = setup();
      await ctx.controller.start(3, 'en');
      ctx.getRealtimeOptions()!.onError?.(new Error('socket broke'));
      expect(ctx.controller.getSnapshot().status).toBe('error');
      expect(ctx.sessions.end).not.toHaveBeenCalled();

      await ctx.controller.start(3, 'en');

      expect(ctx.sessions.end).toHaveBeenCalledOnce();
      expect(ctx.sessions.end).toHaveBeenCalledWith(sessionId);
      expect(ctx.native.sessionStop).toHaveBeenCalledOnce();
      expect(ctx.realtime.close).toHaveBeenCalled();
      expect(ctx.sessions.create).toHaveBeenCalledTimes(2);
      expect(ctx.native.sessionStart).toHaveBeenCalledTimes(2);
      expect(ctx.controller.getSnapshot().error).toBeNull();
    });

    it('leaves nothing to close after a clean stop', async () => {
      const ctx = setup();
      await ctx.controller.start(3, 'en');
      await ctx.controller.stop();
      ctx.sessions.end.mockClear();
      ctx.native.sessionStop.mockClear();
      await ctx.controller.start(3, 'en');
      expect(ctx.sessions.end).not.toHaveBeenCalled();
      expect(ctx.native.sessionStop).not.toHaveBeenCalled();
    });
  });

  describe('Rust still holds a running session', () => {
    it('stops it and retries once, then the meeting runs', async () => {
      const ctx = setup();
      ctx.native.sessionStart.mockRejectedValueOnce('session_already_running');
      await ctx.controller.start(3, 'en');

      expect(ctx.native.sessionStop).toHaveBeenCalledOnce();
      expect(ctx.native.sessionStart).toHaveBeenCalledTimes(2);
      expect(ctx.native.sessionStop.mock.invocationCallOrder[0]).toBeLessThan(
        ctx.native.sessionStart.mock.invocationCallOrder[1]!,
      );
      expect(ctx.controller.getSnapshot().error).toBeNull();
      expect(ctx.controller.getSnapshot().startedAt).not.toBeNull();
    });

    it('also recognises an Error carrying the code', async () => {
      const ctx = setup();
      ctx.native.sessionStart.mockRejectedValueOnce(new Error('session_already_running'));
      await ctx.controller.start(3, 'en');
      expect(ctx.native.sessionStart).toHaveBeenCalledTimes(2);
      expect(ctx.controller.getSnapshot().status).not.toBe('error');
    });

    it('gives up after the second failure, with cleanup and no loop', async () => {
      const ctx = setup();
      ctx.native.sessionStart.mockRejectedValue('session_already_running');
      await ctx.controller.start(3, 'en');

      expect(ctx.native.sessionStart).toHaveBeenCalledTimes(2);
      expect(ctx.sessions.end).toHaveBeenCalledWith(sessionId);
      expect(ctx.controller.getSnapshot()).toMatchObject({
        status: 'error',
        meetingLanguage: null,
      });
    });

    it('leaves no native session running when Stop comes during the retry', async () => {
      const ctx = setup();
      let finish: () => void = () => undefined;
      ctx.native.sessionStart
        .mockRejectedValueOnce('session_already_running')
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = () => resolve({ sessionId: 'local-native-session' });
            }),
        );
      const starting = ctx.controller.start(3, 'en');
      await vi.advanceTimersByTimeAsync(0);
      expect(ctx.native.sessionStart).toHaveBeenCalledTimes(2);

      await ctx.controller.stop();
      finish();
      await starting;

      // One stop from the retry itself, one from Stop, one more because the late start landed.
      const last = ctx.native.sessionStop.mock.invocationCallOrder.at(-1)!;
      expect(last).toBeGreaterThan(ctx.native.sessionStart.mock.invocationCallOrder[1]!);
      expect(ctx.controller.getSnapshot().status).toBe('idle');
    });

    it('does not retry other errors', async () => {
      const ctx = setup();
      ctx.native.sessionStart.mockRejectedValueOnce(new Error('permission denied'));
      await ctx.controller.start(3, 'en');

      expect(ctx.native.sessionStart).toHaveBeenCalledOnce();
      expect(ctx.native.sessionStop).not.toHaveBeenCalled();
      expect(ctx.sessions.end).toHaveBeenCalledWith(sessionId);
      expect(ctx.controller.getSnapshot().status).toBe('error');
    });
  });

  describe('capture problems', () => {
    const error = (message: string): AudioStatusEvent => ({
      type: 'status',
      state: 'error',
      message,
    });

    it('listens before the sidecar starts and keeps an error that arrives right after', async () => {
      const ctx = setup();
      ctx.native.sessionStart.mockImplementationOnce(async () => {
        ctx.emitStatus(error('system audio: tap failed'));
        return { sessionId: 'local' };
      });
      await ctx.controller.start(3, 'en');

      expect(ctx.native.onAudioStatus.mock.invocationCallOrder[0]).toBeLessThan(
        ctx.native.sessionStart.mock.invocationCallOrder[0]!,
      );
      expect(ctx.controller.getSnapshot()).toMatchObject({
        status: 'connecting',
        systemFailed: true,
        micFailed: false,
      });
    });

    it('maps each prefix to its stream and ignores other errors', async () => {
      const ctx = setup();
      await ctx.controller.start(3, 'en');
      ctx.emitStatus(error('model load failed for en'));
      ctx.emitStatus({ type: 'status', state: 'ready', message: 'microphone: fine' });
      expect(ctx.controller.getSnapshot()).toMatchObject({ micFailed: false, systemFailed: false });
      ctx.emitStatus(error('microphone: denied'));
      expect(ctx.controller.getSnapshot()).toMatchObject({ micFailed: true, systemFailed: false });
      ctx.emitStatus(error('system audio: x'));
      expect(ctx.controller.getSnapshot()).toMatchObject({ micFailed: true, systemFailed: true });
    });

    it('clears on stop, unlistens, and starts clean next time', async () => {
      const ctx = setup();
      await ctx.controller.start(3, 'en');
      ctx.emitStatus(error('microphone: denied'));
      await ctx.controller.stop();
      expect(ctx.unlistenStatus).toHaveBeenCalled();
      expect(ctx.controller.getSnapshot()).toMatchObject({ micFailed: false, systemFailed: false });
      await ctx.controller.start(3, 'en');
      expect(ctx.controller.getSnapshot()).toMatchObject({ micFailed: false });
    });
  });

  describe('meeting time', () => {
    function clock() {
      const state = { t: 1_000_000 };
      return { state, now: () => state.t };
    }

    it('starts when capture runs and survives a reconnect', async () => {
      const c = clock();
      const ctx = setup(undefined, { now: c.now });
      await ctx.controller.start(3, 'en');
      expect(ctx.controller.getSnapshot()).toMatchObject({ startedAt: 1_000_000, endedAt: null });
      c.state.t += 10 * 60_000;
      ctx.getRealtimeOptions()!.onState?.('reconnecting');
      c.state.t += 20 * 60_000;
      ctx.getRealtimeOptions()!.onState?.('open');
      await ctx.controller.stop();
      const { startedAt, endedAt } = ctx.controller.getSnapshot();
      expect(startedAt).toBe(1_000_000);
      expect((endedAt ?? 0) - (startedAt ?? 0)).toBe(30 * 60_000);
    });

    it('ends at the Stop press, not at the end of the cloud drain', async () => {
      const c = clock();
      const ctx = setup(undefined, { now: c.now });
      await ctx.controller.start(3, 'vi');
      c.state.t += 60_000;
      const stopping = ctx.controller.stop();
      c.state.t += 10_000;
      await vi.advanceTimersByTimeAsync(3_000);
      await stopping;
      const { startedAt, endedAt } = ctx.controller.getSnapshot();
      expect((endedAt ?? 0) - (startedAt ?? 0)).toBe(60_000);
    });

    it('resets on a new meeting', async () => {
      const c = clock();
      const ctx = setup(undefined, { now: c.now });
      await ctx.controller.start(3, 'en');
      await ctx.controller.stop();
      c.state.t += 5_000;
      await ctx.controller.start(3, 'en');
      expect(ctx.controller.getSnapshot()).toMatchObject({ startedAt: c.state.t, endedAt: null });
    });
  });

  describe('glossary vocabulary', () => {
    it('passes the newest terms (at most 200) to native start', async () => {
      const items = Array.from({ length: 205 }, (_, i) =>
        term(`T${i}`, new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString()),
      );
      const list = vi.fn(async () => items);
      const context = setup(list);

      await context.controller.start(3, 'en');

      expect(list).toHaveBeenCalledWith('en');
      const vocabulary = context.native.sessionStart.mock.calls[0]![0].vocabulary!;
      expect(vocabulary).toHaveLength(200);
      expect(vocabulary[0]).toBe('T204');
      expect(vocabulary).not.toContain('T0');
    });

    it('does not wait more than 1.5 s for a slow glossary, then applies it late', async () => {
      let resolveList!: (items: GlossaryTerm[]) => void;
      const context = setup(() => new Promise((resolve) => (resolveList = resolve)));

      const starting = context.controller.start(3, 'en');
      await vi.advanceTimersByTimeAsync(1_499);
      expect(context.native.sessionStart).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2);
      await starting;
      expect(context.native.sessionStart.mock.calls[0]![0].vocabulary).toEqual([]);

      resolveList([term('SLA')]);
      await vi.advanceTimersByTimeAsync(0);
      expect(context.native.setVocabulary).toHaveBeenCalledWith(['SLA']);
    });

    it('drops a late glossary when the meeting stopped meanwhile', async () => {
      let resolveList!: (items: GlossaryTerm[]) => void;
      const context = setup(() => new Promise((resolve) => (resolveList = resolve)));
      const starting = context.controller.start(3, 'en');
      await vi.advanceTimersByTimeAsync(1_501);
      await starting;
      await context.controller.stop();

      resolveList([term('SLA')]);
      await vi.advanceTimersByTimeAsync(0);
      expect(context.native.setVocabulary).not.toHaveBeenCalled();
    });

    it('refreshes within 500 ms of a change, coalescing a burst, without stopping capture', async () => {
      const list = vi.fn<GlossaryList>(async () => [term('SLA')]);
      const context = setup(list);
      await context.controller.start(3, 'en');
      list.mockResolvedValue([term('SLA'), term('OKR')]);

      context.controller.refreshVocabulary();
      await vi.advanceTimersByTimeAsync(200);
      context.controller.refreshVocabulary();
      context.controller.refreshVocabulary();
      await vi.advanceTimersByTimeAsync(499);
      expect(context.native.setVocabulary).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2);

      expect(context.native.setVocabulary).toHaveBeenCalledOnce();
      expect(context.native.setVocabulary).toHaveBeenCalledWith(['SLA', 'OKR']);
      expect(context.native.sessionStop).not.toHaveBeenCalled();
    });

    it('does nothing when no meeting is running', async () => {
      const list = vi.fn<GlossaryList>(async () => [term('SLA')]);
      const context = setup(list);

      context.controller.refreshVocabulary();
      await vi.advanceTimersByTimeAsync(1_000);

      expect(list).not.toHaveBeenCalled();
      expect(context.native.setVocabulary).not.toHaveBeenCalled();
    });

    it('reloads after a language switch, and sends no terms for Japanese', async () => {
      const list = vi.fn<GlossaryList>(async () => [term('SLA')]);
      const context = setup(list);
      await context.controller.start(3, 'en');
      context.emitAudioModel({ type: 'language-suggestion', language: 'ja', confidence: 0.99 });

      await context.controller.acceptSuggestedLanguage();
      await vi.advanceTimersByTimeAsync(600);

      expect(context.native.setVocabulary).toHaveBeenCalledWith([]);
      expect(list).toHaveBeenCalledTimes(1);
    });

    it('asks for the new list when the language switches back to English', async () => {
      const list = vi.fn<GlossaryList>(async () => [term('SLA')]);
      const context = setup(list);
      await context.controller.start(3, 'ja');
      expect(context.native.sessionStart.mock.calls[0]![0].vocabulary).toEqual([]);
      context.emitAudioModel({ type: 'language-suggestion', language: 'en', confidence: 0.99 });

      await context.controller.acceptSuggestedLanguage();
      await vi.advanceTimersByTimeAsync(600);

      expect(list).toHaveBeenCalledWith('en');
      expect(context.native.setVocabulary).toHaveBeenCalledWith(['SLA']);
    });

    it('starts with no terms when the glossary fails or nobody is signed in', async () => {
      const context = setup(() => Promise.reject(new Error('401')));

      await context.controller.start(3, 'en');

      expect(context.native.sessionStart.mock.calls[0]![0].vocabulary).toEqual([]);
      expect(context.controller.getSnapshot()).toMatchObject({ error: null });
      expect(context.controller.getSnapshot().status).not.toBe('error');
    });

    it('swallows a failing refresh', async () => {
      const context = setup(async () => [term('SLA')]);
      await context.controller.start(3, 'en');
      context.native.setVocabulary.mockRejectedValueOnce(new Error('native down'));

      context.controller.refreshVocabulary();
      await vi.advanceTimersByTimeAsync(600);

      expect(context.controller.getSnapshot().status).not.toBe('error');
    });

    describe('ordering and races', () => {
      /** A glossary whose first call answers at once (the start) and later calls wait to be resolved by hand. */
      function manual(first: GlossaryTerm[] = [term('SLA')]) {
        const pending: ((items: GlossaryTerm[]) => void)[] = [];
        let calls = 0;
        const list = vi.fn<GlossaryList>(() => {
          calls += 1;
          if (calls === 1) return Promise.resolve(first);
          return new Promise((resolve) => pending.push(resolve));
        });
        return { list, pending };
      }
      const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);
      const suggest = (context: ReturnType<typeof setup>, language: 'en' | 'ja') =>
        context.emitAudioModel({ type: 'language-suggestion', language, confidence: 0.99 });

      it('keeps a refresh result when the slow start-time load resolves after it', async () => {
        let resolveStart!: (items: GlossaryTerm[]) => void;
        const resolvers: ((items: GlossaryTerm[]) => void)[] = [];
        let calls = 0;
        const context = setup(() => {
          calls += 1;
          return new Promise((resolve) => {
            if (calls === 1) resolveStart = resolve;
            else resolvers.push(resolve);
          });
        });
        const starting = context.controller.start(3, 'en');
        await advance(1_501);
        await starting;

        context.controller.refreshVocabulary();
        await advance(500);
        resolvers[0]!([term('NEW')]);
        await advance(0);
        resolveStart([term('OLD')]);
        await advance(0);

        expect(context.native.setVocabulary.mock.calls).toEqual([[['NEW']]]);
      });

      it('keeps the second refresh when the first one resolves last', async () => {
        const { list, pending } = manual();
        const context = setup(list);
        await context.controller.start(3, 'en');

        context.controller.refreshVocabulary();
        await advance(500);
        context.controller.refreshVocabulary();
        await advance(500);
        expect(pending).toHaveLength(2);
        pending[1]!([term('SECOND')]);
        await advance(0);
        pending[0]!([term('FIRST')]);
        await advance(0);

        expect(context.native.setVocabulary.mock.calls).toEqual([[['SECOND']]]);
      });

      it('ignores a load from before en -> ja -> en', async () => {
        const { list, pending } = manual();
        const context = setup(list);
        await context.controller.start(3, 'en');
        context.controller.refreshVocabulary();
        await advance(500);

        suggest(context, 'ja');
        await context.controller.acceptSuggestedLanguage();
        await advance(0);
        suggest(context, 'en');
        await context.controller.acceptSuggestedLanguage();
        await advance(0);
        expect(pending).toHaveLength(2);
        pending[1]!([term('NEW')]);
        await advance(0);
        pending[0]!([term('OLD')]);
        await advance(0);

        expect(context.native.setVocabulary.mock.calls).toEqual([[[]], [['NEW']]]);
      });

      it('drops a load that finishes after the language changed', async () => {
        const { list, pending } = manual();
        const context = setup(list);
        await context.controller.start(3, 'en');
        context.controller.refreshVocabulary();
        await advance(500);

        suggest(context, 'ja');
        await context.controller.acceptSuggestedLanguage();
        await advance(0);
        pending[0]!([term('ENGLISH')]);
        await advance(0);

        expect(context.native.setVocabulary.mock.calls).toEqual([[[]]]);
      });

      it('sends nothing when stop() comes while a refresh is loading', async () => {
        const { list, pending } = manual();
        const context = setup(list);
        await context.controller.start(3, 'en');
        context.controller.refreshVocabulary();
        await advance(500);

        await context.controller.stop();
        pending[0]!([term('LATE')]);
        await advance(0);

        expect(context.native.setVocabulary).not.toHaveBeenCalled();
      });

      it('sends nothing when dispose() comes while a refresh is loading', async () => {
        const { list, pending } = manual();
        const context = setup(list);
        await context.controller.start(3, 'en');
        context.controller.refreshVocabulary();
        await advance(500);

        context.controller.dispose();
        pending[0]!([term('LATE')]);
        await advance(0);

        expect(context.native.setVocabulary).not.toHaveBeenCalled();
      });

      it.each(['stop', 'dispose'] as const)(
        'does not load after %s() while the debounce is pending',
        async (how) => {
          const { list } = manual();
          const context = setup(list);
          await context.controller.start(3, 'en');
          context.controller.refreshVocabulary();
          await advance(200);

          if (how === 'stop') await context.controller.stop();
          else context.controller.dispose();
          await advance(2_000);

          expect(list).toHaveBeenCalledTimes(1);
          expect(context.native.setVocabulary).not.toHaveBeenCalled();
        },
      );

      it('refreshes once after capture starts when the glossary changed during startup', async () => {
        const list = vi.fn<GlossaryList>(async () => [term('A')]);
        const context = setup(list);

        const starting = context.controller.start(3, 'en');
        list.mockResolvedValue([term('A'), term('B')]);
        context.controller.refreshVocabulary();
        context.controller.refreshVocabulary();
        await starting;
        await advance(0);

        expect(context.native.sessionStart.mock.calls[0]![0].vocabulary).toEqual(['A']);
        expect(list).toHaveBeenCalledTimes(2);
        expect(context.native.setVocabulary.mock.calls).toEqual([[['A', 'B']]]);
      });

      it('forgets a startup edit when the session is stopped before capture runs', async () => {
        const list = vi.fn<GlossaryList>(async () => [term('A')]);
        const context = setup(list);
        const starting = context.controller.start(3, 'en');
        context.controller.refreshVocabulary();
        await context.controller.stop();
        await starting;
        await context.controller.start(3, 'en');
        await advance(0);

        expect(list).toHaveBeenCalledTimes(2);
        expect(context.native.setVocabulary).not.toHaveBeenCalled();
      });

      it('replaces the list at once on a language change, without the debounce', async () => {
        const list = vi.fn<GlossaryList>(async () => [term('SLA')]);
        const context = setup(list);
        await context.controller.start(3, 'en');

        suggest(context, 'ja');
        await context.controller.acceptSuggestedLanguage();
        await advance(0);
        expect(context.native.setVocabulary.mock.calls).toEqual([[[]]]);

        suggest(context, 'en');
        await context.controller.acceptSuggestedLanguage();
        await advance(0);
        expect(context.native.setVocabulary.mock.calls).toEqual([[[]], [['SLA']]]);
      });

      it('drops terms with control characters or over 120 characters', async () => {
        const context = setup(async () => [
          term('Acme\tCloud'),
          term('Bell\u007f'),
          term('a'.repeat(121)),
          term('SLA'),
        ]);

        await context.controller.start(3, 'en');

        expect(context.native.sessionStart.mock.calls[0]![0].vocabulary).toEqual(['SLA']);
      });

      it('swallows a rejected or throwing setVocabulary', async () => {
        const context = setup(async () => [term('SLA')]);
        await context.controller.start(3, 'en');
        context.native.setVocabulary.mockImplementationOnce(() =>
          Promise.reject(new Error('invalid vocabulary')),
        );
        context.native.setVocabulary.mockImplementationOnce(() => {
          throw new Error('thrown');
        });

        context.controller.refreshVocabulary();
        await advance(600);
        context.controller.refreshVocabulary();
        await advance(600);

        expect(context.native.setVocabulary).toHaveBeenCalledTimes(2);
        expect(context.controller.getSnapshot().status).not.toBe('error');
      });
    });
  });

  describe.each(cloudCodes)('cloud-recognised language (%s)', (lang) => {
    const utterance = (overrides: Partial<UtteranceEvent> = {}): UtteranceEvent => ({
      type: 'utterance',
      segmentId,
      stream: 'system',
      startMs: 100,
      endMs: 900,
      sampleRate: 16000,
      pcm: 'AAAA',
      ...overrides,
    });
    const id2 = '3344ed67-4d83-4778-bcd2-41af6165755f';
    const flush = () => vi.advanceTimersByTimeAsync(0);

    async function running(options: Parameters<typeof setup>[1] = {}) {
      const ctx = setup(undefined, options);
      await ctx.controller.start(3, lang);
      return ctx;
    }

    it('uploads both streams, publishes the text untranslated and sends segment.final for both', async () => {
      const ctx = await running();
      ctx.emitUtterance(utterance());
      ctx.emitUtterance(utterance({ segmentId: id2, stream: 'mic' }));
      await flush();

      expect(ctx.sessions.transcribe).toHaveBeenCalledTimes(2);
      expect(ctx.sessions.transcribe).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({ segmentId, stream: 'system', startMs: 100, endMs: 900 }),
        expect.any(AbortSignal),
      );
      expect(ctx.published).toEqual([
        expect.objectContaining({
          segmentId,
          stream: 'system',
          text: 'xin chào',
          translation: null,
          partial: false,
        }),
        expect.objectContaining({
          segmentId: id2,
          stream: 'mic',
          text: 'xin chào',
          translation: null,
          partial: false,
        }),
      ]);
      expect(ctx.sent).toEqual([
        expect.objectContaining({
          type: 'segment.final',
          stream: 'system',
          text: 'xin chào',
          words: [],
        }),
        expect.objectContaining({
          type: 'segment.final',
          stream: 'mic',
          text: 'xin chào',
          words: [],
        }),
      ]);
    });

    describe('speaker labels', () => {
      const verdicts = (list: NonNullable<TranscribeResponse['speaker']>[]) => {
        let n = 0;
        return vi.fn<Transcribe>(async (_id, input) => ({
          segmentId: input.segmentId,
          text: `câu ${(n += 1)}`,
          ...(list[n - 1] ? { speaker: list[n - 1] } : {}),
        }));
      };
      const speak = async (ctx: Awaited<ReturnType<typeof running>>, stream: 'system' | 'mic') => {
        ctx.emitUtterance(utterance({ segmentId: crypto.randomUUID(), stream }));
        await flush();
      };

      it('asks for labels with an empty list, then sends the people already heard', async () => {
        const transcribe = verdicts([
          { label: 'new', hint: 'male low' },
          { label: 'speaker_1' },
          { label: 'new', hint: 'female high' },
        ]);
        const ctx = await running({ transcribe });
        await speak(ctx, 'system');
        await speak(ctx, 'system');
        await speak(ctx, 'system');

        const sent = transcribe.mock.calls.map(([, input]) => input.knownSpeakers);
        expect(sent[0]).toEqual([]);
        expect(sent[1]).toEqual([{ label: 'speaker_1', hint: 'male low', lastText: 'câu 1' }]);
        expect(sent[2]).toEqual([{ label: 'speaker_1', hint: 'male low', lastText: 'câu 2' }]);
        const finals = ctx.sent as { speaker?: string }[];
        expect(finals.map((message) => message.speaker)).toEqual([
          'speaker_1',
          'speaker_1',
          'speaker_2',
        ]);
        expect(ctx.published.map((event) => event.speaker)).toEqual([
          'speaker_1',
          'speaker_1',
          'speaker_2',
        ]);
      });

      it('never sends knownSpeakers for the microphone and sends no label for it', async () => {
        const transcribe = verdicts([{ label: 'new', hint: 'x' }]);
        const ctx = await running({ transcribe });
        await speak(ctx, 'mic');
        expect(transcribe.mock.calls[0]![1].knownSpeakers).toBeUndefined();
        expect(ctx.published[0]!.speaker).toBeUndefined();
        expect(ctx.sent[0]).not.toHaveProperty('speaker');
      });

      it('shows "Người khác" (no label) for unknown, and when the server sends no verdict', async () => {
        const transcribe = verdicts([{ label: 'unknown' }]);
        const ctx = await running({ transcribe });
        await speak(ctx, 'system');
        await speak(ctx, 'system');
        expect(ctx.published.map((event) => event.speaker)).toEqual([undefined, undefined]);
        expect(ctx.sent.every((message) => !('speaker' in (message as object)))).toBe(true);
      });

      it('forgets everyone when a new meeting starts', async () => {
        const transcribe = verdicts([{ label: 'new', hint: 'male low' }]);
        const ctx = await running({ transcribe });
        await speak(ctx, 'system');
        const stopped = ctx.controller.stop();
        await vi.advanceTimersByTimeAsync(20_000);
        await stopped;
        await ctx.controller.start(3, lang);
        await speak(ctx, 'system');
        expect(transcribe.mock.calls.at(-1)![1].knownSpeakers).toEqual([]);
      });
    });

    describe('context and counting', () => {
      const texts = ['một', 'hai', 'ba', 'bốn'];
      const ids = () => crypto.randomUUID();

      it('sends the last three recognised sentences of the same stream, oldest first', async () => {
        let n = 0;
        const transcribe = vi.fn<Transcribe>(async (_id, input) => ({
          segmentId: input.segmentId,
          text: texts[n++] ?? 'năm',
        }));
        const ctx = await running({ transcribe });
        for (let i = 0; i < 5; i += 1) {
          ctx.emitUtterance(utterance({ segmentId: ids() }));
          await flush();
        }
        const previous = transcribe.mock.calls.map(([, input]) => input.previous);
        expect(previous[0]).toBeUndefined();
        expect(previous[1]).toEqual(['một']);
        expect(previous[3]).toEqual(['một', 'hai', 'ba']);
        expect(previous[4]).toEqual(['hai', 'ba', 'bốn']);
      });

      it('keeps streams apart, skips placeholders and empty text, and cuts at 400 chars', async () => {
        const answers = ['', 'x'.repeat(500)];
        let n = 0;
        const transcribe = vi.fn<Transcribe>(async (_id, input) => ({
          segmentId: input.segmentId,
          text: answers[n++] ?? 'ok',
        }));
        const ctx = await running({ transcribe });
        ctx.emitUtterance(utterance({ segmentId: ids() }));
        await flush();
        ctx.emitUtterance(utterance({ segmentId: ids() }));
        await flush();
        ctx.emitUtterance(utterance({ segmentId: ids(), stream: 'mic' }));
        await flush();
        ctx.emitUtterance(utterance({ segmentId: ids() }));
        await flush();
        const previous = transcribe.mock.calls.map(([, input]) => input.previous);
        expect(previous[1]).toBeUndefined();
        expect(previous[2]).toBeUndefined();
        expect(previous[3]).toEqual(['x'.repeat(400)]);
      });

      it('orders the context by start time even when uploads finish out of order', async () => {
        const releases: ((text: string) => void)[] = [];
        const transcribe = vi.fn<Transcribe>(
          (_id, input) =>
            new Promise((resolve) => {
              releases.push((text) => resolve({ segmentId: input.segmentId, text }));
            }),
        );
        const ctx = await running({ transcribe });
        ctx.emitUtterance(utterance({ segmentId: ids(), startMs: 1_000, endMs: 2_000 }));
        ctx.emitUtterance(utterance({ segmentId: ids(), startMs: 3_000, endMs: 4_000 }));
        await flush();
        releases[1]!('sau');
        await flush();
        releases[0]!('trước');
        await flush();
        ctx.emitUtterance(utterance({ segmentId: ids(), startMs: 5_000, endMs: 6_000 }));
        await flush();
        expect(transcribe.mock.calls[2]![1].previous).toEqual(['trước', 'sau']);
      });

      it('does not use a failed sentence as context', async () => {
        const transcribe = vi
          .fn<Transcribe>()
          .mockRejectedValueOnce(new TranscribeError('no', 400))
          .mockImplementation(async (_id, input) => ({ segmentId: input.segmentId, text: 'ok' }));
        const ctx = await running({ transcribe });
        ctx.emitUtterance(utterance({ segmentId: ids() }));
        await flush();
        ctx.emitUtterance(utterance({ segmentId: ids() }));
        await flush();
        expect(transcribe.mock.calls[1]![1].previous).toBeUndefined();
      });

      it('forgets the context of the previous meeting', async () => {
        const ctx = await running();
        ctx.emitUtterance(utterance({ segmentId: ids() }));
        await flush();
        const stopping = ctx.controller.stop();
        await vi.advanceTimersByTimeAsync(3_000);
        await stopping;
        await ctx.controller.start(3, lang);
        ctx.emitUtterance(utterance({ segmentId: ids() }));
        await flush();
        expect(ctx.sessions.transcribe.mock.calls.at(-1)![1].previous).toBeUndefined();
      });

      it('counts published final sentences, not placeholders or partials', async () => {
        const transcribe = vi
          .fn<Transcribe>()
          .mockRejectedValueOnce(new TranscribeError('no', 400))
          .mockImplementation(async (_id, input) => ({ segmentId: input.segmentId, text: 'ok' }));
        const ctx = await running({ transcribe });
        ctx.emitUtterance(utterance({ segmentId: ids() }));
        await flush();
        ctx.emitUtterance(utterance({ segmentId: ids() }));
        ctx.emitUtterance(utterance({ segmentId: ids(), stream: 'mic' }));
        await flush();
        const stopping = ctx.controller.stop();
        await vi.advanceTimersByTimeAsync(3_000);
        await stopping;
        expect(ctx.controller.getSnapshot().completedSegmentCount).toBe(2);
      });
    });

    it('retries once, then shows a placeholder locally and tells the server nothing', async () => {
      const transcribe = vi.fn<Transcribe>().mockRejectedValue(new Error('boom'));
      const ctx = await running({ transcribe });
      ctx.emitUtterance(utterance());
      await flush();

      expect(transcribe).toHaveBeenCalledTimes(2);
      expect(ctx.published).toEqual([
        expect.objectContaining({
          text: '[không nhận dạng được]',
          translation: null,
          partial: false,
        }),
      ]);
      expect(ctx.sent).toEqual([]);
    });

    it('succeeds on the retry without a placeholder', async () => {
      const transcribe = vi
        .fn<Transcribe>()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ segmentId, text: 'được rồi' });
      const ctx = await running({ transcribe });
      ctx.emitUtterance(utterance());
      await flush();

      expect(ctx.published.map((event) => event.text)).toEqual(['được rồi']);
      expect(ctx.sent).toHaveLength(1);
    });

    it('ignores silence', async () => {
      const ctx = await running({
        transcribe: async (_id, input) => ({ segmentId: input.segmentId, text: '  ' }),
      });
      ctx.emitUtterance(utterance());
      await flush();

      expect(ctx.published).toEqual([]);
      expect(ctx.sent).toEqual([]);
    });

    it('uploads at most three at a time', async () => {
      const releases: (() => void)[] = [];
      const transcribe = vi.fn<Transcribe>(
        (_id, input) =>
          new Promise((resolve) =>
            releases.push(() => resolve({ segmentId: input.segmentId, text: 'a' })),
          ),
      );
      const ctx = await running({ transcribe });
      for (let i = 0; i < 5; i += 1) {
        ctx.emitUtterance(
          utterance({ segmentId: crypto.randomUUID(), startMs: i * 1000, endMs: i * 1000 + 500 }),
        );
      }
      await flush();
      expect(transcribe).toHaveBeenCalledTimes(3);
      releases[0]!();
      await flush();
      expect(transcribe).toHaveBeenCalledTimes(4);
    });

    it('shows a fast result at once without waiting for a slower earlier one', async () => {
      const resolvers: ((text: string) => void)[] = [];
      const transcribe = vi.fn<Transcribe>(
        (_id, input) =>
          new Promise((resolve) =>
            resolvers.push((text) => resolve({ segmentId: input.segmentId, text })),
          ),
      );
      const ctx = await running({ transcribe });
      ctx.emitUtterance(utterance({ segmentId, startMs: 0, endMs: 500 }));
      ctx.emitUtterance(utterance({ segmentId: id2, startMs: 600, endMs: 900 }));
      await flush();
      resolvers[1]!('hai');
      await flush();
      expect(ctx.published.map((event) => event.text)).toEqual(['hai']);
      expect(ctx.sent).toEqual([expect.objectContaining({ segmentId: id2, startMs: 600 })]);
      resolvers[0]!('một');
      await flush();
      expect(ctx.published.map((event) => event.text)).toEqual(['hai', 'một']);
      expect(ctx.sent).toHaveLength(2);
    });

    it('refuses to start without consent and sends no audio', async () => {
      const ctx = setup(undefined, { consent: false });
      await ctx.controller.start(3, lang);

      expect(ctx.controller.getSnapshot().status).toBe('error');
      expect(ctx.controller.getSnapshot().error?.message).toBe('cloud_consent_required');
      expect(ctx.sessions.create).not.toHaveBeenCalled();
      expect(ctx.native.sessionStart).not.toHaveBeenCalled();
      expect(ctx.native.onUtterance).not.toHaveBeenCalled();
    });

    describe('stop drains the last sentences', () => {
      const holdAll = () => {
        const releases: ((text?: string) => void)[] = [];
        const signals: (AbortSignal | undefined)[] = [];
        const transcribe = vi.fn<Transcribe>(
          (_id, input, signal) =>
            new Promise((resolve) => {
              signals.push(signal);
              releases.push((text = 'muộn') => resolve({ segmentId: input.segmentId, text }));
            }),
        );
        return { transcribe, releases, signals };
      };
      const ids = () => crypto.randomUUID();

      it('keeps the status running with the badge language until the drain is done', async () => {
        const held = holdAll();
        const ctx = await running({ transcribe: held.transcribe });
        ctx.emitUtterance(utterance());
        await flush();
        const stopping = ctx.controller.stop();
        await flush();

        expect(ctx.native.sessionStop).toHaveBeenCalledOnce();
        expect(ctx.sessions.end).not.toHaveBeenCalled();
        expect(ctx.controller.getSnapshot()).toMatchObject({
          meetingLanguage: lang,
          completedSessionId: null,
        });
        expect(ctx.controller.getSnapshot().status).not.toBe('idle');

        held.releases[0]!('câu cuối');
        await vi.advanceTimersByTimeAsync(3_000);
        await stopping;

        expect(ctx.published.map((event) => event.text)).toEqual(['câu cuối']);
        expect(ctx.sent).toEqual([expect.objectContaining({ text: 'câu cuối' })]);
        expect(ctx.sessions.end).toHaveBeenCalledWith(sessionId);
        expect(ctx.realtime.close).toHaveBeenCalled();
        expect(ctx.unlistenUtterance).toHaveBeenCalledOnce();
        expect(ctx.controller.getSnapshot()).toMatchObject({
          status: 'idle',
          completedSessionId: sessionId,
          meetingLanguage: null,
        });
      });

      it('sends the stop command before anything else and uploads a flush utterance within 3 s', async () => {
        const ctx = await running();
        const stopping = ctx.controller.stop();
        await vi.advanceTimersByTimeAsync(2_900);
        ctx.emitUtterance(utterance());
        await vi.advanceTimersByTimeAsync(200);
        await stopping;

        expect(ctx.sessions.transcribe).toHaveBeenCalledTimes(1);
        expect(ctx.sent).toHaveLength(1);
      });

      it('takes no utterance later than 3 s after stop', async () => {
        const ctx = await running();
        const stopping = ctx.controller.stop();
        await vi.advanceTimersByTimeAsync(3_001);
        ctx.emitUtterance(utterance());
        await flush();
        await stopping;

        expect(ctx.sessions.transcribe).not.toHaveBeenCalled();
      });

      it('uploads what was queued before stop, including the fourth when a slot frees', async () => {
        const held = holdAll();
        const ctx = await running({ transcribe: held.transcribe });
        for (let i = 0; i < 4; i += 1) ctx.emitUtterance(utterance({ segmentId: ids() }));
        await flush();
        expect(held.transcribe).toHaveBeenCalledTimes(3);
        const stopping = ctx.controller.stop();
        await flush();
        held.releases[0]!();
        await flush();
        expect(held.transcribe).toHaveBeenCalledTimes(4);
        held.releases.slice(1).forEach((release) => release());
        await vi.advanceTimersByTimeAsync(3_000);
        await stopping;

        expect(ctx.published).toHaveLength(4);
        expect(ctx.sent).toHaveLength(4);
      });

      it('ends after 15 s, aborts what is pending and starts nothing more', async () => {
        const held = holdAll();
        const ctx = await running({ transcribe: held.transcribe });
        for (let i = 0; i < 4; i += 1) ctx.emitUtterance(utterance({ segmentId: ids() }));
        await flush();
        const stopping = ctx.controller.stop();
        await vi.advanceTimersByTimeAsync(14_999);
        expect(ctx.sessions.end).not.toHaveBeenCalled();
        expect(held.signals.every((signal) => signal?.aborted === false)).toBe(true);
        await vi.advanceTimersByTimeAsync(1);
        await stopping;

        expect(held.signals.every((signal) => signal?.aborted === true)).toBe(true);
        expect(ctx.sessions.end).toHaveBeenCalledOnce();
        // A slot frees after the deadline: the fourth must not start.
        held.releases.forEach((release) => release('quá muộn'));
        await flush();
        expect(held.transcribe).toHaveBeenCalledTimes(3);
        expect(ctx.published).toEqual([]);
        expect(ctx.sent).toEqual([]);
      });

      it('does not retry after the deadline', async () => {
        let attempts = 0;
        const transcribe = vi.fn<Transcribe>(async (_id, _input, signal) => {
          attempts += 1;
          await new Promise<void>((resolve) =>
            signal?.addEventListener('abort', () => resolve(), { once: true }),
          );
          throw new Error('network');
        });
        const ctx = await running({ transcribe });
        ctx.emitUtterance(utterance());
        await flush();
        const stopping = ctx.controller.stop();
        await vi.advanceTimersByTimeAsync(15_000);
        await stopping;
        await flush();

        expect(attempts).toBe(1);
        expect(ctx.published).toEqual([]);
      });

      it('does not start a second drain when stop is pressed again', async () => {
        const held = holdAll();
        const ctx = await running({ transcribe: held.transcribe });
        ctx.emitUtterance(utterance());
        await flush();
        const first = ctx.controller.stop();
        const second = ctx.controller.stop();
        held.releases[0]!();
        await vi.advanceTimersByTimeAsync(3_000);
        await Promise.all([first, second]);

        expect(ctx.native.sessionStop).toHaveBeenCalledOnce();
        expect(ctx.sessions.end).toHaveBeenCalledOnce();
      });

      it('does not switch language while draining', async () => {
        const ctx = await running();
        ctx.emitAudioModel({ type: 'language-suggestion', language: 'en', confidence: 0.9 });
        const stopping = ctx.controller.stop();
        await ctx.controller.acceptSuggestedLanguage();
        await vi.advanceTimersByTimeAsync(3_000);
        await stopping;

        expect(ctx.sessions.setLanguage).not.toHaveBeenCalled();
      });
    });

    describe('retries', () => {
      const failWith = (status?: number) =>
        vi
          .fn<Transcribe>()
          .mockRejectedValue(new TranscribeError('Transcribe request failed', status));

      it.each([500, 502, 503])('retries once on HTTP %i', async (status) => {
        const transcribe = failWith(status);
        const ctx = await running({ transcribe });
        ctx.emitUtterance(utterance());
        await flush();
        expect(transcribe).toHaveBeenCalledTimes(2);
      });

      it('retries once on a network error or timeout (no status)', async () => {
        const transcribe = failWith(undefined);
        const ctx = await running({ transcribe });
        ctx.emitUtterance(utterance());
        await flush();
        expect(transcribe).toHaveBeenCalledTimes(2);
      });

      it('waits about a second before retrying a 429', async () => {
        const transcribe = failWith(429);
        const ctx = await running({ transcribe });
        ctx.emitUtterance(utterance());
        await vi.advanceTimersByTimeAsync(900);
        expect(transcribe).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(100);
        expect(transcribe).toHaveBeenCalledTimes(2);
        expect(ctx.published.map((event) => event.text)).toEqual(['[không nhận dạng được]']);
      });

      it.each([400, 404, 413, 422])('never retries HTTP %i', async (status) => {
        const transcribe = failWith(status);
        const ctx = await running({ transcribe });
        ctx.emitUtterance(utterance());
        await vi.advanceTimersByTimeAsync(5_000);
        expect(transcribe).toHaveBeenCalledTimes(1);
        expect(ctx.published.map((event) => event.text)).toEqual(['[không nhận dạng được]']);
      });
    });

    describe('the meeting language', () => {
      it('is in the snapshot from start until the meeting has fully ended', async () => {
        const ctx = await running();
        expect(ctx.controller.getSnapshot().meetingLanguage).toBe(lang);
        const stopping = ctx.controller.stop();
        await vi.advanceTimersByTimeAsync(3_000);
        await stopping;
        expect(ctx.controller.getSnapshot().meetingLanguage).toBeNull();
      });

      it('follows an accepted language switch', async () => {
        const ctx = await running();
        ctx.emitAudioModel({ type: 'language-suggestion', language: 'en', confidence: 0.9 });
        await ctx.controller.acceptSuggestedLanguage();
        expect(ctx.controller.getSnapshot().meetingLanguage).toBe('en');
      });

      it('is cleared when the start fails', async () => {
        const ctx = setup();
        ctx.sessions.create.mockRejectedValueOnce(new Error('down'));
        await ctx.controller.start(3, 'en');
        expect(ctx.controller.getSnapshot().meetingLanguage).toBeNull();
      });
    });

    describe('accepting a suggested language', () => {
      it('keeps the meeting running with a notice when switching into a cloud language without consent', async () => {
        const ctx = setup(undefined, { consent: false });
        await ctx.controller.start(3, 'en');
        ctx.getRealtimeOptions()!.onState?.('open');
        ctx.emitAudioModel({ type: 'language-suggestion', language: lang, confidence: 0.9 });
        await ctx.controller.acceptSuggestedLanguage();

        const snapshot = ctx.controller.getSnapshot();
        expect(snapshot.status).toBe('running');
        expect(snapshot.meetingLanguage).toBe('en');
        expect(snapshot.suggestedLanguage).toBeNull();
        expect(snapshot.error?.message).toBe('cloud_consent_required_switch');
        expect(ctx.sessions.setLanguage).not.toHaveBeenCalled();
        expect(ctx.native.setLanguage).not.toHaveBeenCalled();
        expect(ctx.native.onUtterance).not.toHaveBeenCalled();
      });

      it('one consent covers a switch from one cloud language to another', async () => {
        const other = cloudCodes.find((code) => code !== lang)!;
        const ctx = await running();
        ctx.emitAudioModel({ type: 'language-suggestion', language: other, confidence: 0.9 });
        await ctx.controller.acceptSuggestedLanguage();

        expect(ctx.native.setLanguage).toHaveBeenCalledWith(other);
        expect(ctx.controller.getSnapshot()).toMatchObject({ meetingLanguage: other, error: null });
      });

      async function pending() {
        const ctx = setup();
        await ctx.controller.start(3, 'en');
        ctx.emitAudioModel({ type: 'language-suggestion', language: lang, confidence: 0.9 });
        let release: () => void = () => {};
        ctx.sessions.setLanguage.mockImplementationOnce(
          (_id: string, language: string) =>
            new Promise((resolve) => {
              release = () =>
                resolve({
                  id: sessionId,
                  title: null,
                  startedAt: '2026-11-03T00:00:00.000Z',
                  endedAt: null,
                  status: 'live' as const,
                  assistLevel: 3,
                  language: language as 'en',
                });
            }),
        );
        return { ctx, release: () => release() };
      }

      it('does nothing more when Stop came while setLanguage was pending', async () => {
        const { ctx, release } = await pending();
        const accepting = ctx.controller.acceptSuggestedLanguage();
        await ctx.controller.stop();
        release();
        await accepting;

        expect(ctx.native.onUtterance).not.toHaveBeenCalled();
        expect(ctx.native.setLanguage).not.toHaveBeenCalled();
        expect(ctx.controller.getSnapshot().status).toBe('idle');
        expect(ctx.controller.getSnapshot().error).toBeNull();
      });

      it('does nothing more when another meeting started meanwhile', async () => {
        const { ctx, release } = await pending();
        const accepting = ctx.controller.acceptSuggestedLanguage();
        await ctx.controller.stop();
        await ctx.controller.start(3, 'en');
        release();
        await accepting;

        expect(ctx.native.onUtterance).not.toHaveBeenCalled();
        expect(ctx.native.setLanguage).not.toHaveBeenCalled();
        expect(ctx.controller.getSnapshot().error).toBeNull();
      });

      it('stays silent when setLanguage fails after Stop', async () => {
        const { ctx } = await pending();
        let reject: (error: Error) => void = () => {};
        ctx.sessions.setLanguage.mockReset();
        ctx.sessions.setLanguage.mockImplementationOnce(
          () => new Promise((_resolve, rej) => (reject = rej)),
        );
        const accepting = ctx.controller.acceptSuggestedLanguage();
        await ctx.controller.stop();
        reject(new Error('late failure'));
        await accepting;

        expect(ctx.controller.getSnapshot().status).toBe('idle');
        expect(ctx.controller.getSnapshot().error).toBeNull();
      });
    });

    it('does not upload utterances of a device language and never listens for them', async () => {
      const ctx = setup();
      await ctx.controller.start(3, 'en');
      ctx.emitUtterance(utterance());
      await flush();

      expect(ctx.native.onUtterance).not.toHaveBeenCalled();
      expect(ctx.sessions.transcribe).not.toHaveBeenCalled();
    });

    it('does not upload after the meeting switched to a device language', async () => {
      const ctx = await running();
      ctx.emitAudioModel({ type: 'language-suggestion', language: 'en', confidence: 0.9 });
      await ctx.controller.acceptSuggestedLanguage();
      ctx.emitUtterance(utterance());
      await flush();

      expect(ctx.sessions.transcribe).not.toHaveBeenCalled();
    });
  });
});
