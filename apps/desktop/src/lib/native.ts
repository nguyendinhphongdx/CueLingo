/**
 * The only place the webview talks to the Tauri core. UI modules call `native`, never `invoke`.
 * Command/event table: apps/docs/docs/04-modules/01-desktop/tauri-core.md
 */
import { invoke } from '@tauri-apps/api/core';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { z } from 'zod';

export const AssistLevel = z.number().int().min(0).max(5);

export const SessionStartInput = z.object({
  assistLevel: AssistLevel,
  /** Meeting language (`en`, `ja`…); the native side loads the matching recognition model. */
  language: z
    .string()
    .regex(/^[a-z]{2,3}$/)
    .optional(),
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
} as const;

export const TranscriptEvent = z.object({
  segmentId: z.string(),
  stream: z.enum(['system', 'mic']).optional(),
  text: z.string(),
  translation: z.string().nullable(),
  partial: z.boolean(),
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
    type: z.literal('stats'),
    language: z.string(),
    count: z.number().int(),
    p50Ms: z.number(),
    p95Ms: z.number(),
  }),
]);
export type AudioModelEvent = z.infer<typeof AudioModelEvent>;

export const SettingsEvent = z.object({ assistLevel: AssistLevel });
export type SettingsEvent = z.infer<typeof SettingsEvent>;

export const HotkeyEvent = z.object({
  action: z.enum(['toggle_overlay', 'recap', 'say_for_me']),
});
export type HotkeyEvent = z.infer<typeof HotkeyEvent>;

export const native = {
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
  onAudioModel: (cb: (e: AudioModelEvent) => void): Promise<UnlistenFn> =>
    listen('audio-model', (e) => cb(AudioModelEvent.parse(e.payload))),
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
  toggleOverlay: () => invoke('toggle_overlay').then((v) => z.boolean().parse(v)),
  onTranscript: (cb: (e: TranscriptEvent) => void): Promise<UnlistenFn> =>
    listen('transcript', (e) => cb(TranscriptEvent.parse(e.payload))),
  /** Native STT output (emitted by the Rust core from the Swift sidecar). */
  onSegment: (cb: (e: SegmentEvent) => void): Promise<UnlistenFn> =>
    listen('segment', (e) => cb(SegmentEvent.parse(e.payload))),
  /** Windows share state through global events: the main window publishes, the overlay listens. */
  publishTranscript: (e: TranscriptEvent) => emit('transcript', TranscriptEvent.parse(e)),
  /** Tells the other windows (the overlay has its own JS context) that the signed-in person changed. */
  publishAuthChanged: () => emit('auth-changed'),
  onAuthChanged: (cb: () => void): Promise<UnlistenFn> => listen('auth-changed', () => cb()),
  publishSettings: (e: SettingsEvent) => emit('settings', SettingsEvent.parse(e)),
  onSettings: (cb: (e: SettingsEvent) => void): Promise<UnlistenFn> =>
    listen('settings', (e) => cb(SettingsEvent.parse(e.payload))),
  onHotkey: (cb: (e: HotkeyEvent) => void): Promise<UnlistenFn> =>
    listen('hotkey', (e) => cb(HotkeyEvent.parse(e.payload))),
};
