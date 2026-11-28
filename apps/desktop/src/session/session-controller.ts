import type { RealtimeClient, RealtimeClientOptions, RealtimeState } from '@cuelingo/core-sdk';
import {
  DEFAULT_LANGUAGE,
  ErrorCode,
  isLanguageCode,
  languageOptions,
  SUPPORTED_LANGUAGES,
  type GlossaryTerm,
  type LanguageCode,
  type ServerMessage,
  type TranscribeResponse,
  type UsageResponse,
} from '@cuelingo/shared';
import { captureProblemOf, micPermissionOf, type MicPermissionProblem } from './capture-problems';
import { nativeErrorCode } from './session-errors';
import { speakerDisplayName } from '@cuelingo/ui/lib/speaker';
import { createSpeakerRegistry } from './speaker-registry';
import { createFallbackSwitch, hasOfflineModelFor } from './offline-fallback';
import { isMeetingMetric, usageNotice } from './usage-notices';
import type {
  AudioModelEvent,
  AudioStatusEvent,
  NoticeEvent,
  SegmentEvent,
  SessionStartInput,
  SessionStartResult,
  TranscriptEvent,
  UtteranceEvent,
} from '../lib/native';
import type { SelectableAssistLevel } from '../settings';
import type { SessionsApi, TranscribeError } from './sessions-api';

export type SessionStatus = 'idle' | 'connecting' | 'running' | 'reconnecting' | 'error';

/** The newest finished sentence of the running meeting, for the quick look on the Phiên họp card. Memory only. */
export interface LatestCaption {
  segmentId: string;
  /** Who said it, as the person sees it ("Tôi", "Speaker 2", "Người khác"). */
  speaker: string;
  text: string;
  translation: string | null;
}

export interface SessionSnapshot {
  status: SessionStatus;
  error: Error | null;
  completedSessionId: string | null;
  /** Final sentences published during the meeting that just ended. */
  completedSegmentCount: number;
  /** When capture began (ms). Kept across reconnects; null before capture runs. */
  startedAt: number | null;
  /** When the person pressed Stop (ms), so a cloud drain does not count as meeting time. */
  endedAt: number | null;
  /** The sidecar reported that this capture could not start. Cleared on a new meeting and on stop. */
  micFailed: boolean;
  /** Why the microphone is not recording when it is the permission (macOS has not asked, or it was refused). */
  micPermission: MicPermissionProblem | null;
  systemFailed: boolean;
  /** Another language the speakers seem to be using; offered to the person, never applied alone. */
  suggestedLanguage: LanguageCode | null;
  /** Language of the meeting that runs (set at start, cleared once it has fully ended). */
  meetingLanguage: LanguageCode | null;
  /** Cleared when a meeting starts and when it ends; never stored. */
  latestCaption: LatestCaption | null;
}

interface NativeSessionBridge {
  sessionStart(input: SessionStartInput): Promise<SessionStartResult>;
  sessionStop(): Promise<void>;
  hideOverlay(): Promise<void>;
  onSegment(callback: (event: SegmentEvent) => void): Promise<() => void>;
  onUtterance(callback: (event: UtteranceEvent) => void): Promise<() => void>;
  onAudioModel(callback: (event: AudioModelEvent) => void): Promise<() => void>;
  onAudioStatus(callback: (event: AudioStatusEvent) => void): Promise<() => void>;
  setLanguage(language: string): Promise<void>;
  setVocabulary(terms: string[]): Promise<void>;
  publishTranscript(event: TranscriptEvent): Promise<void>;
  publishNotice(event: NoticeEvent): Promise<void>;
}

interface SessionControllerOptions {
  native: NativeSessionBridge;
  sessions: Pick<SessionsApi, 'create' | 'end' | 'setLanguage' | 'transcribe'>;
  /** The person's glossary; its terms go to the speech model so it spells them right. */
  glossary?: { list(language: LanguageCode): Promise<GlossaryTerm[]> };
  /** Whether the person agreed to send meeting audio to the cloud (ADR 0014); without it a cloud-language meeting does not start. */
  hasCloudConsent?: () => boolean;
  /**
   * Recognition on this machine for when the cloud is out of reach (ADR 0024); without it a meeting never goes
   * offline. `enabled` is the person's choice in Cài đặt, `transcribe` takes one utterance (PCM16 base64) and
   * rejects with `model_missing` when the model is not downloaded, `release` frees the model after a meeting.
   */
  offline?: {
    enabled(): boolean;
    transcribe(pcm: string): Promise<string>;
    release?(): void;
  };
  /** Reads the person's allowances at the start of a meeting, to warn about the ones running low. Failures are ignored. */
  usage?: { get(): Promise<UsageResponse> };
  /** Whether there is a plan to buy; read when an allowance runs out so the notice can offer Nâng cấp. Failures mean no. */
  canUpgrade?: () => Promise<boolean>;
  createRealtime(options: RealtimeClientOptions): RealtimeClient;
  /** Called once per meeting, with its id, when the first final caption of a real meeting appears (never for the demo). */
  onFirstCaption?: (sessionId: string) => void;
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

/** Uploads running at once; each is one utterance of a few seconds. */
const UPLOAD_CONCURRENCY = 3;
/** After Stop the sidecar flushes its last utterance; later ones are not taken. */
const DRAIN_ACCEPT_MS = 3_000;
/** Uploads still pending this long after Stop are aborted and dropped. */
const DRAIN_DEADLINE_MS = 15_000;
/** With the offline fallback on, how long one cloud attempt may take before this machine takes the sentence. */
const OFFLINE_CLOUD_WAIT_MS = 8_000;
/** Wait before retrying a rate-limited upload. */
const RATE_LIMIT_RETRY_MS = 1_000;
/** Recognised sentences of the same stream sent along as context, oldest first. */
const PREVIOUS_COUNT = 3;
const PREVIOUS_MAX_CHARS = 400;
/** Shown in place of a sentence the cloud could not recognise (after one retry). */
export const UNRECOGNISED_TEXT = '[không nhận dạng được]';

/** What `recognise` returns when the cloud refused for lack of allowance. */
const QUOTA_EXHAUSTED = Symbol('quota-exhausted');

/** Uploads of one running meeting; replaced (and so abandoned) when the meeting ends. */
interface CloudUploads {
  active: number;
  queue: (() => Promise<void>)[];
  /** Nothing starts once closed (deadline passed or meeting abandoned). */
  closed: boolean;
  abort: AbortController;
  onIdle: (() => void) | null;
}

function newUploads(): CloudUploads {
  return { active: 0, queue: [], closed: false, abort: new AbortController(), onIdle: null };
}

/** Only what can heal is retried: no HTTP status (network, timeout), 5xx and 429. */
function isRetryable(error: unknown): boolean {
  const status = (error as Partial<TranscribeError> | null)?.status;
  return status === undefined || status >= 500 || status === 429;
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done, { once: true });
  });
}

const isCloudLanguage = (language: LanguageCode) =>
  SUPPORTED_LANGUAGES[language].recognition === 'cloud';

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
  hasCloudConsent = () => false,
  offline,
  usage,
  canUpgrade,
  createRealtime,
  onFirstCaption,
  now = Date.now,
  apiUrl = 'ws://localhost:4000',
  token = '',
}: SessionControllerOptions): SessionController {
  let snapshot: SessionSnapshot = {
    status: 'idle',
    error: null,
    completedSessionId: null,
    completedSegmentCount: 0,
    startedAt: null,
    endedAt: null,
    micFailed: false,
    micPermission: null,
    systemFailed: false,
    suggestedLanguage: null,
    meetingLanguage: null,
    latestCaption: null,
  };
  let realtime: RealtimeClient | null = null;
  let activeSessionId: string | null = null;
  let meetingLanguage: LanguageCode = DEFAULT_LANGUAGE;
  let stopPromise: Promise<void> | null = null;
  let stopSegmentListener: (() => void) | null = null;
  let stopModelListener: (() => void) | null = null;
  let stopStatusListener: (() => void) | null = null;
  let stopUtteranceListener: (() => void) | null = null;
  let utteranceRegistration = 0;
  let uploads = newUploads();
  /** True from Stop until the 3 s flush window of a cloud meeting is over. */
  let acceptingAfterStop = false;
  let stopping = false;
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
  /** Ids of final sentences published in this meeting. */
  const finalIds = new Set<string>();
  let firstCaptionReported = false;
  /** Recognised text of the latest sentences per stream, sent as context for the next upload. */
  const recentTexts: Record<'system' | 'mic', { startMs: number; text: string }[]> = {
    system: [],
    mic: [],
  };
  /** The people heard in this meeting, in memory only; cleared when the meeting ends and when one starts. */
  const speakerRegistry = createSpeakerRegistry(now);
  const transcriptById = new Map<string, TranscriptEvent>();
  /** Notices already shown in this meeting (by id), so a reconnect or a second reading never repeats one. */
  const shownNotices = new Set<string>();
  /** The cloud refused recognition for lack of allowance: no more audio goes up for this meeting. */
  let cloudQuotaExhausted = false;
  /** Cloud or this machine, for the meeting that runs (ADR 0024); only used when `offline` is given. */
  let fallback = createFallbackSwitch();
  let offlineAnnouncements = 0;
  const listeners = new Set<() => void>();

  function update(next: Partial<SessionSnapshot>) {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
  }

  /** The overlay follows the meeting: it goes away when the meeting is over. Never throws. */
  function hideOverlay() {
    void Promise.resolve()
      .then(() => native.hideOverlay())
      .catch(() => undefined);
  }

  /** Tells the person once per meeting. Never throws and never holds meeting text. */
  function notify(notice: NoticeEvent | null) {
    if (!notice || shownNotices.has(notice.id)) return;
    shownNotices.add(notice.id);
    void Promise.resolve()
      .then(() => native.publishNotice(notice))
      .catch(() => undefined);
  }

  /** A usage notice; an exhausted one offers Nâng cấp when there is a plan to buy (a failed check means no). */
  function notifyUsage(metric: string, item: Parameters<typeof usageNotice>[1]) {
    if (item.state !== 'exhausted' || !canUpgrade) return notify(usageNotice(metric, item));
    void canUpgrade()
      .catch(() => false)
      .then((upgradable) => notify(usageNotice(metric, item, { canUpgrade: upgradable })));
  }

  /** Stops sending audio to the cloud for the rest of the meeting; the meeting itself goes on. */
  function stopCloudUploads() {
    cloudQuotaExhausted = true;
    uploads.queue = [];
    notifyUsage('cloud_stt_ms', { used: 0, limit: 0, state: 'exhausted' });
  }

  /** Warns about allowances that are already low or used up when the meeting starts. */
  async function warnAboutUsage(generation: number, language: LanguageCode) {
    if (!usage) return;
    let response: UsageResponse;
    try {
      response = await usage.get();
    } catch {
      return; // Warnings are a courtesy; the meeting does not depend on them.
    }
    if (generation !== runtimeGeneration) return;
    for (const [metric, item] of Object.entries(response.usage)) {
      // Cloud recognition only matters to a meeting that uses it.
      if (metric === 'cloud_stt_ms') {
        if (!isCloudLanguage(language)) continue;
        if (item.state === 'exhausted' && item.limit !== null) cloudQuotaExhausted = true;
      }
      notifyUsage(metric, item);
    }
  }

  function fail(error: unknown) {
    update({
      status: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }

  function publish(input: TranscriptEvent) {
    const event = {
      ...input,
      language: input.language ?? meetingLanguage,
      // The overlay is another window: this is how it learns which meeting to ask about.
      ...(activeSessionId ? { sessionId: activeSessionId } : {}),
    };
    transcriptById.set(event.segmentId, event);
    if (!event.partial && event.text !== UNRECOGNISED_TEXT) {
      finalIds.add(event.segmentId);
      if (!firstCaptionReported && activeSessionId) {
        firstCaptionReported = true;
        try {
          onFirstCaption?.(activeSessionId);
        } catch {
          // Counting must never get in the way of a caption.
        }
      }
    }
    if (!event.partial && event.text !== UNRECOGNISED_TEXT) {
      update({
        latestCaption: {
          segmentId: event.segmentId,
          speaker: speakerDisplayName({
            label: event.speaker ?? null,
            source: event.stream ?? 'system',
          }),
          text: event.text,
          translation: event.translation,
        },
      });
    }
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

    // The device recognises English: the server stores both streams as text, translates only the system one.
    if (!segment.partial) {
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

  /** The fallback is on, and this meeting's language has a model here. */
  const offlineOn = () =>
    offline !== undefined && offline.enabled() && hasOfflineModelFor(meetingLanguage);

  /**
   * Tells the person the meeting now runs on this machine, and why. Said again each time it happens.
   * Sentences recognised here send no audio anywhere; the cloud is only tried again now and then, with one sentence.
   */
  function announceOffline(reason: 'network' | 'quota') {
    offlineAnnouncements += 1;
    if (reason === 'quota') {
      // The usual notice offers Nâng cấp; this one says what happens instead.
      notifyUsage('cloud_stt_ms', { used: 0, limit: 0, state: 'exhausted' });
    }
    notify({
      id: `offline-stt-${offlineAnnouncements}`,
      tone: 'warning',
      text:
        reason === 'quota'
          ? 'Đã hết giờ nhận dạng đám mây, tiếp tục nhận dạng trên máy (ngoại tuyến). Chất lượng có thể thấp hơn; câu nhận dạng trên máy không gửi âm thanh đi.'
          : 'Mất kết nối nhận dạng đám mây, đang nhận dạng trên máy (ngoại tuyến). Chất lượng có thể thấp hơn; câu nhận dạng trên máy không gửi âm thanh đi, CueLingo chỉ thỉnh thoảng thử lại đám mây bằng một câu.',
    });
  }

  /** One sentence on this machine; null when it could not be recognised. Never logs the error (it may echo audio). */
  async function recogniseOffline(utterance: UtteranceEvent): Promise<string | null> {
    try {
      return await offline!.transcribe(utterance.pcm);
    } catch (error) {
      if (String(error).includes('model_missing')) {
        notify({
          id: 'offline-model-missing',
          tone: 'warning',
          text: 'Chưa có model nhận dạng ngoại tuyến. Mở Cài đặt để tải về.',
          action: 'open-settings',
        });
      }
      return null;
    }
  }

  /** Runs at most UPLOAD_CONCURRENCY tasks of the current meeting at once. */
  function pump(current: CloudUploads) {
    while (!current.closed && current.active < UPLOAD_CONCURRENCY && current.queue.length > 0) {
      const task = current.queue.shift()!;
      current.active += 1;
      void task().finally(() => {
        current.active -= 1;
        pump(current);
        if (current.active === 0 && current.queue.length === 0) current.onIdle?.();
      });
    }
  }

  /** Uploads one utterance; the error is never inspected or logged (it could echo the request). */
  async function recognise(
    sessionId: string,
    utterance: UtteranceEvent,
    signal: AbortSignal,
    previous: string[],
    labelsSpeakers: boolean,
    /** The offline fallback is on: one short attempt, since this machine can take the sentence instead. */
    quick = false,
  ): Promise<TranscribeResponse | null | typeof QUOTA_EXHAUSTED> {
    const request = {
      ...(previous.length > 0 ? { previous } : {}),
      // Present (even empty) asks the server to label who speaks; only the other side of the call is labelled.
      ...(labelsSpeakers && utterance.stream === 'system'
        ? { knownSpeakers: speakerRegistry.known() }
        : {}),
      segmentId: utterance.segmentId,
      stream: utterance.stream,
      startMs: Math.round(utterance.startMs),
      endMs: Math.round(utterance.endMs),
      sampleRate: utterance.sampleRate,
      pcm: utterance.pcm,
    };
    const attempts = quick ? 1 : 2;
    // A network that goes quiet would otherwise hold the sentence for the full 16 s limit, twice.
    const limit = quick ? new AbortController() : null;
    const stop = () => limit?.abort();
    const timer = limit ? setTimeout(stop, OFFLINE_CLOUD_WAIT_MS) : null;
    signal.addEventListener('abort', stop, { once: true });
    try {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          return await sessions.transcribe(sessionId, request, limit?.signal ?? signal);
        } catch (error) {
          // Running out of allowance does not heal by waiting (it is a 429, so check it before the retry rule).
          if ((error as Partial<TranscribeError> | null)?.code === ErrorCode.QuotaExceeded)
            return QUOTA_EXHAUSTED;
          // Retry once, and only for what can heal; give up on this sentence otherwise.
          if (attempt === attempts - 1 || signal.aborted || !isRetryable(error)) return null;
          if ((error as Partial<TranscribeError>).status === 429) {
            await pause(RATE_LIMIT_RETRY_MS, signal);
            if (signal.aborted) return null;
          }
        }
      }
      return null;
    } finally {
      if (timer) clearTimeout(timer);
      signal.removeEventListener('abort', stop);
    }
  }

  function handleUtterance(utterance: UtteranceEvent) {
    const sessionId = activeSessionId;
    // Audio never leaves without consent, and never for a language the device recognises itself.
    if (!sessionId || !isCloudLanguage(meetingLanguage) || !hasCloudConsent()) return;
    if (stopping && !acceptingAfterStop) return;
    const fallbackOn = offlineOn();
    if (cloudQuotaExhausted && !fallbackOn) return;
    const generation = runtimeGeneration;
    const current = uploads;

    current.queue.push(async () => {
      if (cloudQuotaExhausted && !fallbackOn) return;
      const previous = recentTexts[utterance.stream]
        .slice(-PREVIOUS_COUNT)
        .map((entry) => entry.text);
      const labelsSpeakers = SUPPORTED_LANGUAGES[meetingLanguage].labelsSpeakers;
      // Offline: the cloud allowance is used up, or the cloud has failed lately and only an occasional
      // sentence is sent to find out whether it is back. Otherwise the cloud goes first.
      if (fallbackOn && cloudQuotaExhausted && fallback.pinLocal()) announceOffline('quota');
      let goOffline = fallbackOn && (cloudQuotaExhausted || !fallback.shouldTryCloud(now()));
      let result: TranscribeResponse | null = null;
      if (!goOffline) {
        let outcome: Awaited<ReturnType<typeof recognise>>;
        try {
          outcome = await recognise(
            sessionId,
            utterance,
            current.abort.signal,
            previous,
            labelsSpeakers,
            fallbackOn,
          );
        } finally {
          fallback.probeEnded();
        }
        if (generation !== runtimeGeneration || current.closed) return;
        if (outcome === QUOTA_EXHAUSTED) {
          if (!fallbackOn) {
            // No caption for this sentence and no "[không nhận dạng được]" line: the notice says why.
            stopCloudUploads();
            return;
          }
          cloudQuotaExhausted = true;
          if (fallback.pinLocal()) announceOffline('quota');
          goOffline = true;
        } else if (outcome === null && fallbackOn) {
          // This sentence is recognised here as well, so a failure leaves no gap.
          if (fallback.cloudFailed(now())) announceOffline('network');
          goOffline = true;
        } else {
          if (outcome !== null && fallbackOn) fallback.cloudWorked();
          result = outcome;
        }
      }
      let text: string | null;
      if (goOffline) {
        text = await recogniseOffline(utterance);
        if (generation !== runtimeGeneration || current.closed) return;
      } else {
        text = result === null ? null : result.text;
      }
      // Each result goes out as soon as it is ready; a slow upload never holds a later one back.
      if (text === null) {
        // Local only: the server never hears about a sentence it did not recognise.
        publish({
          segmentId: utterance.segmentId,
          stream: utterance.stream,
          text: UNRECOGNISED_TEXT,
          translation: null,
          partial: false,
          ...(goOffline ? { offline: true } : {}),
        });
        return;
      }
      if (text.trim() === '') return;
      // Uploads finish in any order; the model needs the sentences in the order they were spoken.
      recentTexts[utterance.stream] = [
        ...recentTexts[utterance.stream],
        { startMs: utterance.startMs, text: text.slice(0, PREVIOUS_MAX_CHARS) },
      ]
        .sort((a, b) => a.startMs - b.startMs)
        .slice(-PREVIOUS_COUNT);
      // A server that does not label (older, or a language without labels) sends no verdict: no label.
      const speaker =
        labelsSpeakers && utterance.stream === 'system' && !goOffline
          ? speakerRegistry.resolve(result?.speaker, text)
          : null;
      publish({
        segmentId: utterance.segmentId,
        stream: utterance.stream,
        text,
        translation: null,
        partial: false,
        ...(speaker ? { speaker } : {}),
        ...(goOffline ? { offline: true } : {}),
      });
      realtime?.send({
        type: 'segment.final',
        segmentId: utterance.segmentId,
        stream: utterance.stream,
        startMs: Math.round(utterance.startMs),
        endMs: Math.round(utterance.endMs),
        text,
        words: [],
        ...(speaker ? { speaker } : {}),
      });
    });
    pump(current);
  }

  async function listenForUtterances() {
    if (stopUtteranceListener) return;
    const registration = ++utteranceRegistration;
    const unlisten = await native.onUtterance(handleUtterance);
    if (registration !== utteranceRegistration || stopUtteranceListener) unlisten();
    else stopUtteranceListener = unlisten;
  }

  function handleMessage(message: ServerMessage) {
    if (message.type === 'translation') {
      const transcript = transcriptById.get(message.segmentId);
      if (transcript) publish({ ...transcript, translation: message.textVi, partial: false });
    } else if (message.type === 'usage') {
      // Only 'low' and 'exhausted' are sent; the server sends each once per connection, the set once per meeting.
      if (isMeetingMetric(message.metric)) notifyUsage(message.metric, message.item);
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

  /** Capture failures come within milliseconds of the sidecar starting, so this listens before it does. */
  function handleAudioStatus(event: AudioStatusEvent) {
    const permission = micPermissionOf(event.message);
    if (permission === 'authorized') {
      // Allowed while the meeting runs (the dialog was answered): the banner goes away.
      if (snapshot.micFailed || snapshot.micPermission)
        update({ micFailed: false, micPermission: null });
      return;
    }
    if (event.state !== 'error') return;
    const markMicFailed = (micPermission: MicPermissionProblem | null) => {
      const first = !snapshot.micFailed;
      update({ micFailed: true, micPermission });
      if (first) {
        notify({
          id: 'capture:mic',
          tone: 'error',
          text: 'Không dùng được micro nên CueLingo chưa nghe được giọng bạn',
          action: 'open-settings',
        });
      }
    };
    if (permission && snapshot.micPermission !== permission) {
      markMicFailed(permission);
      return;
    }
    const problem = captureProblemOf(event.message);
    if (problem === 'mic' && !snapshot.micFailed) markMicFailed(null);
    if (problem === 'system' && !snapshot.systemFailed) update({ systemFailed: true });
  }

  async function listenForAudioStatus() {
    const registration = listenerRegistration;
    const unlisten = await native.onAudioStatus(handleAudioStatus);
    if (registration !== listenerRegistration) unlisten();
    else stopStatusListener = unlisten;
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
    stopStatusListener?.();
    stopStatusListener = null;
    utteranceRegistration += 1;
    stopUtteranceListener?.();
    stopUtteranceListener = null;
    uploads.closed = true;
    uploads.queue = [];
    uploads.abort.abort();
    uploads = newUploads();
    realtime?.close();
    realtime = null;
    demoTimers.forEach(clearTimeout);
    demoTimers = [];
    transcriptById.clear();
    speakerRegistry.clear();
    try {
      offline?.release?.();
    } catch {
      // Freeing memory must never get in the way of ending a meeting.
    }
  }

  /**
   * After Stop: takes new utterances for DRAIN_ACCEPT_MS, then waits for every queued and in-flight
   * upload, but never past DRAIN_DEADLINE_MS; what is still pending then is aborted and dropped.
   */
  async function drainUploads() {
    const current = uploads;
    acceptingAfterStop = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => timers.push(setTimeout(resolve, ms)));
    const idle = () =>
      new Promise<void>((resolve) => {
        if (current.active === 0 && current.queue.length === 0) resolve();
        else current.onIdle = resolve;
      });
    const finished = wait(DRAIN_ACCEPT_MS).then(() => {
      acceptingAfterStop = false;
      return idle().then(() => 'idle' as const);
    });
    const outcome = await Promise.race([
      finished,
      wait(DRAIN_DEADLINE_MS).then(() => 'deadline' as const),
    ]);
    timers.forEach(clearTimeout);
    acceptingAfterStop = false;
    current.onIdle = null;
    if (outcome === 'deadline') {
      current.closed = true;
      current.queue = [];
      current.abort.abort();
    }
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

  /**
   * Closes whatever an earlier meeting left behind (runtime, native capture, server session).
   * The state is taken synchronously; the network calls are best effort and never throw.
   */
  function releaseLeftovers(): Promise<unknown> | null {
    const oldId = activeSessionId;
    const capturing = captureRunning;
    clearRuntime();
    activeSessionId = null;
    captureRunning = false;
    if (!capturing && !oldId) return null;
    return Promise.all([
      capturing ? stopNativeQuietly() : undefined,
      oldId ? Promise.resolve(sessions.end(oldId)).catch(() => undefined) : undefined,
    ]);
  }

  const stopNativeQuietly = () =>
    Promise.resolve()
      .then(() => native.sessionStop())
      .catch(() => undefined);

  /**
   * Starts the native session. If Rust still holds a running one (this controller knows it has
   * none), it is stopped and the start is tried once more; any other failure goes to the caller.
   */
  async function startNative(input: SessionStartInput) {
    try {
      return await native.sessionStart(input);
    } catch (error) {
      if (nativeErrorCode(error) !== 'session_already_running') throw error;
      await stopNativeQuietly();
      return native.sessionStart(input);
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
      // A meeting that ended in 'error' may still hold a native capture and a server session.
      const leftovers = releaseLeftovers();
      if (isCloudLanguage(language) && !hasCloudConsent()) {
        await leftovers;
        fail(new Error('cloud_consent_required'));
        return;
      }
      meetingLanguage = language;
      finalIds.clear();
      shownNotices.clear();
      cloudQuotaExhausted = false;
      fallback = createFallbackSwitch();
      offlineAnnouncements = 0;
      firstCaptionReported = false;
      recentTexts.system = [];
      recentTexts.mic = [];
      speakerRegistry.clear();
      const generation = runtimeGeneration;
      startingGeneration = generation;
      update({
        status: 'connecting',
        error: null,
        completedSessionId: null,
        completedSegmentCount: 0,
        startedAt: null,
        endedAt: null,
        micFailed: false,
        micPermission: null,
        systemFailed: false,
        suggestedLanguage: null,
        meetingLanguage: language,
        latestCaption: null,
      });
      if (leftovers) await leftovers;

      const startRequest = ++vocabularyRequest;
      const pendingVocabulary = loadVocabulary(language);
      let deadline: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<null>((resolve) => {
        deadline = setTimeout(() => resolve(null), VOCABULARY_WAIT_MS);
      });

      let createdSessionId: string | null = null;
      let nativeStarted = false;
      /** Ends the server session of this start unless Stop (or another owner) already took it. */
      const endCreatedSession = async () => {
        if (createdSessionId === null || activeSessionId !== createdSessionId) return;
        const id = createdSessionId;
        activeSessionId = null;
        await sessions.end(id).catch(() => undefined);
      };

      try {
        // The listeners do not need the session id, so they register while the server creates it.
        const listening = Promise.all([
          listenForSegments(),
          listenForAudioModel(),
          listenForAudioStatus(),
          isCloudLanguage(language) ? listenForUtterances() : undefined,
        ]);
        const creating = sessions.create({ assistLevel, language });
        let session: Awaited<typeof creating>;
        try {
          [session] = await Promise.all([creating, listening]);
        } catch (error) {
          // A listener failed while the server may still be creating the session: end it, never leave it.
          await listening.catch(() => undefined);
          const orphan = await creating.catch(() => null);
          if (orphan) {
            createdSessionId = orphan.id;
            activeSessionId = orphan.id;
          }
          throw error;
        }
        createdSessionId = session.id;
        if (generation !== runtimeGeneration) {
          await sessions.end(session.id).catch(() => undefined);
          return;
        }
        activeSessionId = session.id;
        if (generation !== runtimeGeneration) return endCreatedSession();
        const loaded = glossary ? await Promise.race([pendingVocabulary, timeout]) : undefined;
        if (generation !== runtimeGeneration) return endCreatedSession();
        await startNative({
          assistLevel,
          language,
          detect: languageOptions()
            .map((option) => option.value)
            .filter((code) => code !== language),
          ...(loaded === undefined ? {} : { vocabulary: loaded ?? [] }),
        });
        nativeStarted = true;
        if (generation !== runtimeGeneration) {
          await native.sessionStop();
          await endCreatedSession();
          return;
        }
        captureRunning = true;
        startingGeneration = null;
        update({ startedAt: now() });
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
          features: ['usage'],
          onMessage: handleMessage,
          onState(state) {
            const status = realtimeStatus(state);
            if (status) update({ status, error: null });
          },
          onError: fail,
        });
        realtime.connect();
        void warnAboutUsage(generation, language);
      } catch (error) {
        if (generation !== runtimeGeneration) return;
        clearRuntime();
        // Nothing may stay behind: Rust would keep a running session and refuse every later start.
        if (nativeStarted) await stopNativeQuietly();
        await endCreatedSession();
        activeSessionId = null;
        captureRunning = false;
        update({
          meetingLanguage: null,
          micFailed: false,
          micPermission: null,
          systemFailed: false,
          latestCaption: null,
        });
        hideOverlay();
        fail(error);
      } finally {
        clearTimeout(deadline);
      }
    },
    async stop() {
      if (stopPromise) return stopPromise;

      const sessionId = activeSessionId;
      // Meeting time ends here, not when the last upload of a cloud drain lands.
      if (snapshot.startedAt !== null && snapshot.endedAt === null) update({ endedAt: now() });
      const drains = sessionId !== null && captureRunning && isCloudLanguage(meetingLanguage);
      const finish = (nativeError: unknown, apiResult: PromiseSettledResult<unknown>) => {
        const error =
          nativeError !== undefined
            ? nativeError
            : apiResult.status === 'rejected'
              ? apiResult.reason
              : null;
        update({
          status: nativeError !== undefined ? 'error' : 'idle',
          error: error instanceof Error || error === null ? error : new Error(String(error)),
          completedSessionId: sessionId ?? snapshot.completedSessionId,
          completedSegmentCount: sessionId ? finalIds.size : snapshot.completedSegmentCount,
          meetingLanguage: null,
          micFailed: false,
          micPermission: null,
          systemFailed: false,
          latestCaption: null,
        });
        hideOverlay();
      };

      if (drains) {
        // The status stays as it is until the last sentence is sent (the panel keeps its badge).
        stopping = true;
        stopPromise = (async () => {
          const draining = drainUploads();
          const nativeResult = await Promise.allSettled([native.sessionStop()]);
          await draining;
          const apiResult = (await Promise.allSettled([sessions.end(sessionId)]))[0];
          activeSessionId = null;
          stopping = false;
          clearRuntime();
          finish(
            nativeResult[0].status === 'rejected'
              ? (nativeResult[0].reason ?? new Error('stop'))
              : undefined,
            apiResult,
          );
        })().finally(() => {
          stopping = false;
          stopPromise = null;
        });
        return stopPromise;
      }

      activeSessionId = null;
      clearRuntime();
      stopPromise = (async () => {
        const [nativeResult, apiResult] = await Promise.allSettled([
          native.sessionStop(),
          sessionId ? sessions.end(sessionId) : Promise.resolve(),
        ]);
        finish(
          nativeResult.status === 'rejected'
            ? (nativeResult.reason ?? new Error('stop'))
            : undefined,
          apiResult,
        );
      })().finally(() => {
        stopPromise = null;
      });
      return stopPromise;
    },
    async acceptSuggestedLanguage() {
      const target = snapshot.suggestedLanguage;
      const sessionId = activeSessionId;
      update({ suggestedLanguage: null });
      if (!target || !sessionId || stopping) return;
      // Switching into a cloud language needs the same consent as starting in one. The meeting
      // goes on in its own language; only a notice is shown (the status must not change).
      if (isCloudLanguage(target) && !hasCloudConsent()) {
        update({ error: new Error('cloud_consent_required_switch') });
        return;
      }
      const generation = runtimeGeneration;
      // A Stop or a new meeting while a step was pending makes this switch stale: it does nothing more.
      const stale = () =>
        generation !== runtimeGeneration || activeSessionId !== sessionId || stopping;
      try {
        // The server first (the realtime side re-reads it), then the open socket, then the speech model.
        await sessions.setLanguage(sessionId, target);
        if (stale()) return;
        realtime?.send({ type: 'language.set' });
        if (isCloudLanguage(target)) await listenForUtterances();
        if (stale()) return;
        await native.setLanguage(target);
        if (stale()) return;
        meetingLanguage = target;
        update({ meetingLanguage: target });
        // The new language's list replaces the old one right away, without the debounce.
        if (vocabularyTimer) clearTimeout(vocabularyTimer);
        vocabularyTimer = null;
        void refreshNow();
      } catch (error) {
        if (!stale()) fail(error);
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
