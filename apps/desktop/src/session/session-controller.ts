import type { RealtimeClient, RealtimeClientOptions, RealtimeState } from '@cuelingo/core-sdk';
import { DEFAULT_LANGUAGE, type LanguageCode, type ServerMessage } from '@cuelingo/shared';
import type {
  SegmentEvent,
  SessionStartInput,
  SessionStartResult,
  TranscriptEvent,
} from '../lib/native';
import type { SelectableAssistLevel } from '../settings';
import type { SessionsApi } from './sessions-api';

export type SessionStatus = 'idle' | 'connecting' | 'running' | 'reconnecting' | 'error';

export interface SessionSnapshot {
  status: SessionStatus;
  error: Error | null;
  completedSessionId: string | null;
}

interface NativeSessionBridge {
  sessionStart(input: SessionStartInput): Promise<SessionStartResult>;
  sessionStop(): Promise<void>;
  onSegment(callback: (event: SegmentEvent) => void): Promise<() => void>;
  publishTranscript(event: TranscriptEvent): Promise<void>;
}

interface SessionControllerOptions {
  native: NativeSessionBridge;
  sessions: Pick<SessionsApi, 'create' | 'end'>;
  createRealtime(options: RealtimeClientOptions): RealtimeClient;
  now?: () => number;
  apiUrl?: string;
  token?: string | (() => string);
}

export interface SessionController {
  getSnapshot(): SessionSnapshot;
  subscribe(listener: () => void): () => void;
  start(assistLevel: SelectableAssistLevel, language?: LanguageCode): Promise<void>;
  stop(): Promise<void>;
  runDemo(): void;
  dispose(): void;
}

const DEMO_SEGMENT_IDS = [
  '03a17ead-bb73-4ad8-9c3a-f2de4307776a',
  '03a17ead-bb73-4ad8-9c3a-f2de4307776a',
  '6c1759bb-4004-4078-a720-569067522b4f',
  '6c1759bb-4004-4078-a720-569067522b4f',
  '3344ed67-4d83-4778-bcd2-41af6165755f',
  '3344ed67-4d83-4778-bcd2-41af6165755f',
] as const;
const DEMO_TEXT = [
  'Let us review the plan…',
  'Let us review the plan for this week.',
  'The first milestone…',
  'The first milestone is ready for review.',
  'Next, we should discuss…',
  'Next, we should discuss the launch timeline.',
] as const;

function realtimeStatus(state: RealtimeState): SessionStatus | null {
  switch (state) {
    case 'connecting':
      return 'connecting';
    case 'open':
      return 'running';
    case 'reconnecting':
      return 'reconnecting';
    case 'idle':
    case 'closed':
      return null;
  }
}

function realtimeUrl(apiUrl: string, sessionId: string) {
  return `${apiUrl.replace(/\/$/, '')}/v1/sessions/${sessionId}/stream`;
}

export function createSessionController({
  native,
  sessions,
  createRealtime,
  now = Date.now,
  apiUrl = 'ws://localhost:4000',
  token = '',
}: SessionControllerOptions): SessionController {
  let snapshot: SessionSnapshot = { status: 'idle', error: null, completedSessionId: null };
  let realtime: RealtimeClient | null = null;
  let activeSessionId: string | null = null;
  let stopPromise: Promise<void> | null = null;
  let stopSegmentListener: (() => void) | null = null;
  let listenerRegistration = 0;
  let runtimeGeneration = 0;
  let demoTimers: ReturnType<typeof setTimeout>[] = [];
  const transcriptById = new Map<string, TranscriptEvent>();
  const listeners = new Set<() => void>();

  function update(next: Partial<SessionSnapshot>) {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
  }

  function fail(error: unknown) {
    update({
      status: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }

  function publish(event: TranscriptEvent) {
    transcriptById.set(event.segmentId, event);
    void native.publishTranscript(event).catch(fail);
  }

  function handleSegment(segment: SegmentEvent) {
    publish({
      segmentId: segment.segmentId,
      stream: segment.stream,
      text: segment.text,
      translation: null,
      partial: segment.partial,
    });

    if (!segment.partial && segment.stream === 'system') {
      realtime?.send({
        type: 'segment.final',
        segmentId: segment.segmentId,
        stream: segment.stream,
        startMs: segment.startMs,
        endMs: segment.endMs,
        text: segment.text,
        words: segment.words,
      });
    }
  }

  function handleMessage(message: ServerMessage) {
    if (message.type === 'translation') {
      const transcript = transcriptById.get(message.segmentId);
      if (transcript) publish({ ...transcript, translation: message.textVi, partial: false });
    } else if (message.type === 'error' && !message.retryable) {
      // Retryable errors (one sentence failed to translate) must not end the session.
      fail(new Error(message.code));
    }
  }

  async function listenForSegments() {
    const registration = ++listenerRegistration;
    const unlisten = await native.onSegment(handleSegment);
    if (registration !== listenerRegistration) unlisten();
    else stopSegmentListener = unlisten;
  }

  function clearRuntime() {
    runtimeGeneration += 1;
    listenerRegistration += 1;
    stopSegmentListener?.();
    stopSegmentListener = null;
    realtime?.close();
    realtime = null;
    demoTimers.forEach(clearTimeout);
    demoTimers = [];
    transcriptById.clear();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async start(assistLevel, language = DEFAULT_LANGUAGE) {
      if (snapshot.status !== 'idle' && snapshot.status !== 'error') return;
      clearRuntime();
      const generation = runtimeGeneration;
      update({ status: 'connecting', error: null, completedSessionId: null });

      try {
        const session = await sessions.create({ assistLevel, language });
        if (generation !== runtimeGeneration) {
          await sessions.end(session.id).catch(() => undefined);
          return;
        }
        activeSessionId = session.id;
        await listenForSegments();
        if (generation !== runtimeGeneration) return;
        await native.sessionStart({ assistLevel });
        if (generation !== runtimeGeneration) {
          await native.sessionStop();
          return;
        }
        realtime = createRealtime({
          url: realtimeUrl(apiUrl, session.id),
          token: typeof token === 'function' ? token() : token,
          sessionId: session.id,
          assistLevel,
          onMessage: handleMessage,
          onState(state) {
            const status = realtimeStatus(state);
            if (status) update({ status, error: null });
          },
          onError: fail,
        });
        realtime.connect();
      } catch (error) {
        if (generation !== runtimeGeneration) return;
        clearRuntime();
        fail(error);
      }
    },
    async stop() {
      if (stopPromise) return stopPromise;

      const sessionId = activeSessionId;
      activeSessionId = null;
      clearRuntime();
      stopPromise = (async () => {
        const [nativeResult, apiResult] = await Promise.allSettled([
          native.sessionStop(),
          sessionId ? sessions.end(sessionId) : Promise.resolve(),
        ]);
        const error =
          nativeResult.status === 'rejected'
            ? nativeResult.reason
            : apiResult.status === 'rejected'
              ? apiResult.reason
              : null;
        update({
          status: nativeResult.status === 'rejected' ? 'error' : 'idle',
          error: error instanceof Error || error === null ? error : new Error(String(error)),
          completedSessionId: sessionId ?? snapshot.completedSessionId,
        });
      })().finally(() => {
        stopPromise = null;
      });
      return stopPromise;
    },
    runDemo() {
      demoTimers.forEach(clearTimeout);
      demoTimers = DEMO_TEXT.map((text, index) =>
        setTimeout(() => {
          const startMs = now();
          handleSegment({
            segmentId: DEMO_SEGMENT_IDS[index]!,
            stream: 'system',
            startMs,
            endMs: startMs + 1_000,
            text,
            words: [],
            partial: index % 2 === 0,
          });
        }, index * 1_500),
      );
    },
    dispose() {
      clearRuntime();
      listeners.clear();
    },
  };
}
