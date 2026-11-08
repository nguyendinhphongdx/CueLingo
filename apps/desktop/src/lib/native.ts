/**
 * The only place the webview talks to the Tauri core. UI modules call `native`, never `invoke`.
 * Command/event table: apps/docs/docs/04-modules/01-desktop/tauri-core.md
 */
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { platform, version as osVersion } from '@tauri-apps/plugin-os';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { z } from 'zod';

export interface UpdateOffer {
  version: string;
  notes: string | null;
  /** Downloads, verifies the signature, installs and restarts. Rejects when the signature does not match. */
  install(): Promise<void>;
}

function isMissingUpdater(error: unknown) {
  const text = String(error);
  return /not (found|allowed|registered)|plugin:updater/i.test(text) && !/signature/i.test(text);
}

export const AssistLevel = z.number().int().min(0).max(5);

/** Glossary terms handed to the speech model's corrector: at most 200, each as long as a glossary term. */
export const Vocabulary = z.array(z.string().min(1).max(120)).max(200);

export const SessionStartInput = z.object({
  assistLevel: AssistLevel,
  /** Meeting language (`en`, `ja`…); the native side loads the matching recognition model. */
  language: z
    .string()
    .regex(/^[a-z]{2,3}$/)
    .optional(),
  /** Other languages to listen for at the start; the native side suggests a switch if one fits better. */
  detect: z
    .array(z.string().regex(/^[a-z]{2,3}$/))
    .max(8)
    .optional(),
  /** The person's glossary terms, so the speech model spells them right from the first sentence. */
  vocabulary: Vocabulary.optional(),
});
export type SessionStartInput = z.infer<typeof SessionStartInput>;

export const SessionStartResult = z.object({ sessionId: z.string().min(1) });
export type SessionStartResult = z.infer<typeof SessionStartResult>;

export const PermissionState = z.enum(['granted', 'denied', 'undetermined', 'unknown']);
export const PermissionsStatus = z.object({
  microphone: PermissionState,
  systemAudio: PermissionState,
});
export type PermissionsStatus = z.infer<typeof PermissionsStatus>;

export const SystemAudioCheck = z.enum(['granted', 'silent', 'error', 'unknown']);
export type SystemAudioCheck = z.infer<typeof SystemAudioCheck>;

export const PRIVACY_PANES = {
  microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  systemAudio: 'x-apple.systempreferences:com.apple.preference.security?Privacy_AudioCapture',
  calendar: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars',
} as const;

export const TranscriptEvent = z.object({
  segmentId: z.string(),
  stream: z.enum(['system', 'mic']).optional(),
  text: z.string(),
  translation: z.string().nullable(),
  partial: z.boolean(),
  /** Language of `text` (the meeting's); English when left out. */
  language: z.string().optional(),
  /** Who spoke: `speaker_1`..`speaker_8` for a labelled other person; left out for the user and for "Người khác". */
  speaker: z
    .string()
    .regex(/^speaker_[1-8]$/)
    .optional(),
});
export type TranscriptEvent = z.infer<typeof TranscriptEvent>;

/** A speech segment from the native STT (partial while being spoken, final when the sentence ends). */
export const SegmentEvent = z.object({
  segmentId: z.uuid(),
  stream: z.enum(['system', 'mic']),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  text: z.string(),
  words: z.array(z.object({ text: z.string(), startMs: z.number(), endMs: z.number() })),
  partial: z.boolean(),
});
export type SegmentEvent = z.infer<typeof SegmentEvent>;

/** One finished utterance of a cloud-recognised meeting: 16-bit LE mono PCM, base64 (ADR 0014). Never log it. */
export const UtteranceEvent = z.object({
  type: z.literal('utterance'),
  segmentId: z.uuid(),
  stream: z.enum(['system', 'mic']),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  sampleRate: z.literal(16000),
  pcm: z.base64(),
});
export type UtteranceEvent = z.infer<typeof UtteranceEvent>;

/** Loudness of one stream, about ten times a second while a meeting runs (0..1). */
export const LevelEvent = z.object({
  type: z.literal('level'),
  stream: z.enum(['system', 'mic']),
  rms: z.number().min(0).max(1),
  peak: z.number().min(0).max(1),
});
export type LevelEvent = z.infer<typeof LevelEvent>;

/** The sidecar's own state; an `error` message starts with `system audio: ` or `microphone: ` when a capture failed to start. */
export const AudioStatusEvent = z.object({
  type: z.literal('status'),
  state: z.enum(['loading', 'ready', 'error', 'stopped']),
  message: z.string().optional(),
});
export type AudioStatusEvent = z.infer<typeof AudioStatusEvent>;

/** The speech model loading (or a language switch finishing), and recognition time once a session ends. */
export const AudioModelEvent = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('model'),
    language: z.string(),
    state: z.enum(['downloading', 'ready', 'error']),
    progress: z.number().min(0).max(1).optional(),
    message: z.string().optional(),
  }),
  z.object({
    type: z.literal('language-suggestion'),
    language: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  z.object({
    type: z.literal('stats'),
    language: z.string(),
    count: z.number().int(),
    p50Ms: z.number(),
    p95Ms: z.number(),
  }),
]);
export type AudioModelEvent = z.infer<typeof AudioModelEvent>;

/** The calendar on this machine, read by the native side; null when the native side is missing. */
export const CalendarResult = z.object({
  type: z.literal('calendar'),
  state: z.enum(['granted', 'denied', 'undetermined']),
  events: z
    .array(
      z.object({
        title: z.string(),
        startMs: z.number(),
        endMs: z.number(),
        location: z.string(),
        attendeeDomains: z.array(z.string()),
      }),
    )
    .optional(),
});
export type CalendarResult = z.infer<typeof CalendarResult>;

export const SettingsEvent = z.object({ assistLevel: AssistLevel });
export type SettingsEvent = z.infer<typeof SettingsEvent>;

export const HotkeyEvent = z.object({
  action: z.enum(['toggle_overlay', 'recap', 'say_for_me']),
});
export type HotkeyEvent = z.infer<typeof HotkeyEvent>;

/** What the app tells the server about itself with a piece of feedback. Never anything about the person. */
export interface AppInfo {
  version: string;
  os: string;
}

export const native = {
  /** The app's version and the OS it runs on; falls back to placeholders rather than failing a report. */
  appInfo: async (): Promise<AppInfo> => {
    const [version, os] = await Promise.all([
      getVersion().catch(() => 'unknown'),
      // plugin-os is sync in v2; wrapped so a failure never blocks a report.
      Promise.resolve()
        .then(() => `${platform() === 'macos' ? 'macOS' : platform()} ${osVersion()}`)
        .catch(() => 'macOS'),
    ]);
    return { version, os };
  },
  /**
   * Asks the update endpoint for a newer build. `null` when up to date, and also when this build has
   * no updater (dev and local builds): "plugin not found" is not an error for the person.
   */
  checkUpdate: async (): Promise<UpdateOffer | null> => {
    let update;
    try {
      update = await check();
    } catch (error) {
      if (isMissingUpdater(error)) return null;
      throw error;
    }
    if (!update) return null;
    return {
      version: update.version,
      notes: update.body ?? null,
      install: async () => {
        await update.downloadAndInstall();
        await relaunch();
      },
    };
  },
  sessionStart: (opts: SessionStartInput) =>
    invoke('session_start', { opts: SessionStartInput.parse(opts) }).then((v) =>
      SessionStartResult.parse(v),
    ),
  /** Switches the running meeting's recognition model; captions go on with the old one until it is ready. */
  setLanguage: (language: string) =>
    invoke('session_set_language', {
      language: z
        .string()
        .regex(/^[a-z]{2,3}$/)
        .parse(language),
    }).then(() => undefined),
  /** Replaces the running meeting's glossary terms (the whole list, not a patch). */
  setVocabulary: async (terms: string[]) => {
    // async: invalid input becomes a rejected promise, never a synchronous throw.
    await invoke('session_set_vocabulary', { terms: Vocabulary.parse(terms) });
  },
  onAudioModel: (cb: (e: AudioModelEvent) => void): Promise<UnlistenFn> =>
    listen('audio-model', (e) => cb(AudioModelEvent.parse(e.payload))),
  /** `request` shows macOS's own permission prompt the first time; `events` lists the next meetings. */
  calendar: (mode: 'status' | 'request' | 'events') =>
    invoke('calendar', { mode }).then((v) => CalendarResult.nullable().parse(v)),
  sessionStop: () => invoke('session_stop').then(() => undefined),
  /** The device token kept in the macOS Keychain; null when nobody is signed in. */
  authTokenGet: () => invoke('auth_token_get').then((v) => z.string().nullable().parse(v)),
  authTokenSet: (token: string) => invoke('auth_token_set', { token }).then(() => undefined),
  authTokenClear: () => invoke('auth_token_clear').then(() => undefined),
  /** Fires when the browser hands back a sign-in code through the cuelingo:// link. */
  onAuthCode: (cb: (code: string) => void): Promise<UnlistenFn> =>
    listen('auth-code', (e) => cb(z.string().parse(e.payload))),
  /** Opens a web page or a macOS privacy pane with the system handler (the webview cannot open windows). */
  openUrl: (url: string) =>
    invoke('open_external', { url: z.string().min(1).parse(url) }).then(() => undefined),
  /** Plays a short system sound and reports whether the app heard it: the only way to test system-audio permission. */
  checkSystemAudio: () => invoke('check_system_audio').then((v) => SystemAudioCheck.parse(v)),
  permissionsStatus: () => invoke('permissions_status').then((v) => PermissionsStatus.parse(v)),
  setAssistLevel: (level: number) =>
    invoke('set_assist_level', { level: AssistLevel.parse(level) }).then(() => undefined),
  hideOverlay: () => invoke('hide_overlay').then(() => undefined),
  /** What the menu-bar icon cannot know: a meeting still going, whole minutes, the stream that failed. Fixed codes only, never meeting content. */
  trayReport: (view: { active: boolean; minutes: number; problem?: 'mic' | 'system' | 'both' }) =>
    invoke('tray_report', view).then(() => undefined),
  /** The menu-bar "Dừng họp" item was chosen. */
  onTrayStop: (cb: () => void): Promise<UnlistenFn> => listen('tray-stop', () => cb()),
  toggleOverlay: () => invoke('toggle_overlay').then((v) => z.boolean().parse(v)),
  onTranscript: (cb: (e: TranscriptEvent) => void): Promise<UnlistenFn> =>
    listen('transcript', (e) => cb(TranscriptEvent.parse(e.payload))),
  /** Native STT output (emitted by the Rust core from the Swift sidecar). */
  onSegment: (cb: (e: SegmentEvent) => void): Promise<UnlistenFn> =>
    listen('segment', (e) => cb(SegmentEvent.parse(e.payload))),
  /** Utterance audio for languages recognised in the cloud (emitted by the Rust core from the Swift sidecar). */
  onUtterance: (cb: (e: UtteranceEvent) => void): Promise<UnlistenFn> =>
    listen('audio-utterance', (e) => cb(UtteranceEvent.parse(e.payload))),
  /** Audio level of each stream while capturing (emitted by the Rust core from the Swift sidecar). */
  onLevel: (cb: (e: LevelEvent) => void): Promise<UnlistenFn> =>
    listen('audio-level', (e) => cb(LevelEvent.parse(e.payload))),
  /** Sidecar state changes (emitted by the Rust core from the Swift sidecar). */
  onAudioStatus: (cb: (e: AudioStatusEvent) => void): Promise<UnlistenFn> =>
    listen('audio-status', (e) => cb(AudioStatusEvent.parse(e.payload))),
  /** Windows share state through global events: the main window publishes, the overlay listens. */
  publishTranscript: (e: TranscriptEvent) => emit('transcript', TranscriptEvent.parse(e)),
  /** Tells the other windows (the overlay has its own JS context) that the signed-in person changed. */
  publishAuthChanged: () => emit('auth-changed'),
  /** Restarts the app (the updater uses the same plugin); rejects where it cannot, e.g. an unsigned dev build. */
  relaunchApp: () => relaunch(),
  onAuthChanged: (cb: () => void): Promise<UnlistenFn> => listen('auth-changed', () => cb()),
  publishSettings: (e: SettingsEvent) => emit('settings', SettingsEvent.parse(e)),
  onSettings: (cb: (e: SettingsEvent) => void): Promise<UnlistenFn> =>
    listen('settings', (e) => cb(SettingsEvent.parse(e.payload))),
  onHotkey: (cb: (e: HotkeyEvent) => void): Promise<UnlistenFn> =>
    listen('hotkey', (e) => cb(HotkeyEvent.parse(e.payload))),
};
