import type { GlossaryTerm, LanguageCode } from '@cuelingo/shared';
import type { RealtimeClient, RealtimeClientOptions } from '@cuelingo/core-sdk';
import type {
  AudioModelEvent,
  SegmentEvent,
  SessionStartInput,
  TranscriptEvent,
} from '../lib/native';
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

function setup(glossaryList?: GlossaryList) {
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
    onSegment: vi.fn(async (callback: (event: SegmentEvent) => void) => {
      onSegment = callback;
      return vi.fn();
    }),
    onAudioModel: vi.fn(async (callback: (event: AudioModelEvent) => void) => {
      onAudioModel = callback;
      return vi.fn();
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
    glossary: glossaryList ? { list: glossaryList } : undefined,
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
});
