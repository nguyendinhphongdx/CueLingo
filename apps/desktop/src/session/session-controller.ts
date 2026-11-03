import type { RealtimeClient, RealtimeClientOptions, RealtimeState } from '@cuelingo/core-sdk';
import {
  DEFAULT_LANGUAGE,
  isLanguageCode,
  languageOptions,
  type GlossaryTerm,
  type LanguageCode,
  type ServerMessage,
} from '@cuelingo/shared';
import type {
  AudioModelEvent,
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
  /** Another language the speakers seem to be using; offered to the person, never applied alone. */
  suggestedLanguage: LanguageCode | null;
}

interface NativeSessionBridge {
  sessionStart(input: SessionStartInput): Promise<SessionStartResult>;
  sessionStop(): Promise<void>;
  onSegment(callback: (event: SegmentEvent) => void): Promise<() => void>;
  onAudioModel(callback: (event: AudioModelEvent) => void): Promise<() => void>;
  setLanguage(language: string): Promise<void>;
  setVocabulary(terms: string[]): Promise<void>;
  publishTranscript(event: TranscriptEvent): Promise<void>;
}

interface SessionControllerOptions {
  native: NativeSessionBridge;
  sessions: Pick<SessionsApi, 'create' | 'end' | 'setLanguage'>;
  /** The person's glossary; its terms go to the speech model so it spells them right. */
  glossary?: { list(language: LanguageCode): Promise<GlossaryTerm[]> };
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
  /** Switch the running meeting to the language the native side heard. */
  acceptSuggestedLanguage(): Promise<void>;
  dismissSuggestedLanguage(): void;
  /** Send the current glossary to the speech model of the running meeting (no-op when none runs). */
  refreshVocabulary(): void;
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

/** The speech corrector's rules are written for English; other languages get no terms until they are evaluated. */
const VOCABULARY_LANGUAGES: readonly LanguageCode[] = ['en'];
const VOCABULARY_LIMIT = 200;
/** A slow glossary must not delay the first caption. */
const VOCABULARY_WAIT_MS = 1_500;
/** Edits that come in a burst are sent once. */
const VOCABULARY_DEBOUNCE_MS = 500;
/** Same limit as the native side, which drops longer terms. */
const VOCABULARY_TERM_MAX = 120;

/** Control characters (below 32, or 127) would be dropped by the native side; drop them here so one odd entry never breaks a meeting. */
function isSendableTerm(term: string): boolean {
  if (term.length === 0 || term.length > VOCABULARY_TERM_MAX) return false;
  for (let i = 0; i < term.length; i += 1) {
    const code = term.charCodeAt(i);
    if (code < 32 || code === 127) return false;
  }
  return true;
}

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
  glossary,
  createRealtime,
  now = Date.now,
  apiUrl = 'ws://localhost:4000',
  token = '',
}: SessionControllerOptions): SessionController {
  let snapshot: SessionSnapshot = {
    status: 'idle',
    error: null,
    completedSessionId: null,
    suggestedLanguage: null,
  };
  let realtime: RealtimeClient | null = null;
  let activeSessionId: string | null = null;
  let meetingLanguage: LanguageCode = DEFAULT_LANGUAGE;
  let stopPromise: Promise<void> | null = null;
  let stopSegmentListener: (() => void) | null = null;
  let stopModelListener: (() => void) | null = null;
  let listenerRegistration = 0;
  let runtimeGeneration = 0;
  let demoTimers: ReturnType<typeof setTimeout>[] = [];
  let captureRunning = false;
  let vocabularyTimer: ReturnType<typeof setTimeout> | null = null;
  /** Grows with every load; a load whose number is no longer the latest must not reach the speech model. */
  let vocabularyRequest = 0;
  /** Generation of a session that is starting (capture not running yet), else null. */
  let startingGeneration: number | null = null;
  /** The glossary changed while the session was starting; refresh once capture runs. */
  let refreshPending = false;
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

  function publish(input: TranscriptEvent) {
    const event = { ...input, language: input.language ?? meetingLanguage };
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

  function handleAudioModel(event: AudioModelEvent) {
    if (event.type !== 'language-suggestion') return;
    if (isLanguageCode(event.language) && event.language !== meetingLanguage) {
      update({ suggestedLanguage: event.language });
    }
  }

  async function listenForAudioModel() {
    const registration = listenerRegistration;
    const unlisten = await native.onAudioModel(handleAudioModel);
    if (registration !== listenerRegistration) unlisten();
    else stopModelListener = unlisten;
  }

  /** The newest terms for the language; never rejects (a failed or signed-out glossary means no terms). */
  async function loadVocabulary(language: LanguageCode): Promise<string[]> {
    if (!glossary || !VOCABULARY_LANGUAGES.includes(language)) return [];
    try {
      const items = await glossary.list(language);
      return items
        .filter((item) => isSendableTerm(item.term))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, VOCABULARY_LIMIT)
        .map((item) => item.term);
    } catch {
      return [];
    }
  }

  function clearRuntime() {
    runtimeGeneration += 1;
    captureRunning = false;
    startingGeneration = null;
    refreshPending = false;
    if (vocabularyTimer) clearTimeout(vocabularyTimer);
    vocabularyTimer = null;
    listenerRegistration += 1;
    stopSegmentListener?.();
    stopSegmentListener = null;
    stopModelListener?.();
    stopModelListener = null;
    realtime?.close();
    realtime = null;
    demoTimers.forEach(clearTimeout);
    demoTimers = [];
    transcriptById.clear();
  }

  /** Loads the list and sends it unless something newer (a later load, a stop, a language change) won. */
  async function refreshNow() {
    if (!glossary || !captureRunning) return;
    const generation = runtimeGeneration;
    const language = meetingLanguage;
    const request = ++vocabularyRequest;
    const terms = await loadVocabulary(language);
    if (
      generation !== runtimeGeneration ||
      !captureRunning ||
      language !== meetingLanguage ||
      request !== vocabularyRequest
    )
      return;
    await sendVocabulary(terms);
  }

  async function sendVocabulary(terms: string[]) {
    try {
      await native.setVocabulary(terms);
    } catch {
      // The meeting goes on with the old terms.
    }
  }

  const controller: SessionController = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async start(assistLevel, language = DEFAULT_LANGUAGE) {
      if (snapshot.status !== 'idle' && snapshot.status !== 'error') return;
      clearRuntime();
      meetingLanguage = language;
      const generation = runtimeGeneration;
      startingGeneration = generation;
      update({
        status: 'connecting',
        error: null,
        completedSessionId: null,
        suggestedLanguage: null,
      });

      const startRequest = ++vocabularyRequest;
      const pendingVocabulary = loadVocabulary(language);
      let deadline: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<null>((resolve) => {
        deadline = setTimeout(() => resolve(null), VOCABULARY_WAIT_MS);
      });

      try {
        const session = await sessions.create({ assistLevel, language });
        if (generation !== runtimeGeneration) {
          await sessions.end(session.id).catch(() => undefined);
          return;
        }
        activeSessionId = session.id;
        await listenForSegments();
        await listenForAudioModel();
        if (generation !== runtimeGeneration) return;
        const loaded = glossary ? await Promise.race([pendingVocabulary, timeout]) : undefined;
        if (generation !== runtimeGeneration) return;
        await native.sessionStart({
          assistLevel,
          language,
          detect: languageOptions()
            .map((option) => option.value)
            .filter((code) => code !== language),
          ...(loaded === undefined ? {} : { vocabulary: loaded ?? [] }),
        });
        if (generation !== runtimeGeneration) {
          await native.sessionStop();
          return;
        }
        captureRunning = true;
        startingGeneration = null;
        if (refreshPending) {
          refreshPending = false;
          void refreshNow();
        } else if (loaded === null) {
          // Too slow for the first caption: apply the terms as soon as they arrive.
          void pendingVocabulary.then((terms) => {
            const stillSame =
              generation === runtimeGeneration &&
              captureRunning &&
              meetingLanguage === language &&
              startRequest === vocabularyRequest;
            if (stillSame && terms.length > 0) void sendVocabulary(terms);
          });
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
      } finally {
        clearTimeout(deadline);
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
    async acceptSuggestedLanguage() {
      const target = snapshot.suggestedLanguage;
      const sessionId = activeSessionId;
      update({ suggestedLanguage: null });
      if (!target || !sessionId) return;
      try {
        // The server first (the realtime side re-reads it), then the open socket, then the speech model.
        await sessions.setLanguage(sessionId, target);
        realtime?.send({ type: 'language.set' });
        await native.setLanguage(target);
        meetingLanguage = target;
        // The new language's list replaces the old one right away, without the debounce.
        if (vocabularyTimer) clearTimeout(vocabularyTimer);
        vocabularyTimer = null;
        void refreshNow();
      } catch (error) {
        fail(error);
      }
    },
    dismissSuggestedLanguage() {
      update({ suggestedLanguage: null });
    },
    refreshVocabulary() {
      if (!glossary) return;
      if (!captureRunning) {
        if (startingGeneration === runtimeGeneration) refreshPending = true;
        return;
      }
      if (vocabularyTimer) clearTimeout(vocabularyTimer);
      vocabularyTimer = setTimeout(() => {
        vocabularyTimer = null;
        void refreshNow();
      }, VOCABULARY_DEBOUNCE_MS);
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
  return controller;
}
