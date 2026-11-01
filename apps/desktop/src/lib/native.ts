/**
 * The only place the webview talks to the Tauri core. UI modules call `native`, never `invoke`.
 * Command/event table: apps/docs/docs/04-modules/01-desktop/tauri-core.md
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { z } from 'zod';

export const AssistLevel = z.number().int().min(0).max(5);

export const SessionStartInput = z.object({ assistLevel: AssistLevel });
export type SessionStartInput = z.infer<typeof SessionStartInput>;

export const SessionStartResult = z.object({ sessionId: z.string().min(1) });
export type SessionStartResult = z.infer<typeof SessionStartResult>;

export const PermissionState = z.enum(['granted', 'denied', 'unknown']);
export const PermissionsStatus = z.object({
  microphone: PermissionState,
  screenCapture: PermissionState,
});
export type PermissionsStatus = z.infer<typeof PermissionsStatus>;

export const TranscriptEvent = z.object({
  segmentId: z.string(),
  text: z.string(),
  translation: z.string().nullable(),
  partial: z.boolean(),
});
export type TranscriptEvent = z.infer<typeof TranscriptEvent>;

export const HotkeyEvent = z.object({
  action: z.enum(['toggle_overlay', 'recap', 'say_for_me']),
});
export type HotkeyEvent = z.infer<typeof HotkeyEvent>;

export const native = {
  sessionStart: (opts: SessionStartInput) =>
    invoke('session_start', { opts: SessionStartInput.parse(opts) }).then((v) =>
      SessionStartResult.parse(v),
    ),
  sessionStop: () => invoke('session_stop').then(() => undefined),
  permissionsStatus: () => invoke('permissions_status').then((v) => PermissionsStatus.parse(v)),
  setAssistLevel: (level: number) =>
    invoke('set_assist_level', { level: AssistLevel.parse(level) }).then(() => undefined),
  toggleOverlay: () => invoke('toggle_overlay').then((v) => z.boolean().parse(v)),
  onTranscript: (cb: (e: TranscriptEvent) => void): Promise<UnlistenFn> =>
    listen('transcript', (e) => cb(TranscriptEvent.parse(e.payload))),
  onHotkey: (cb: (e: HotkeyEvent) => void): Promise<UnlistenFn> =>
    listen('hotkey', (e) => cb(HotkeyEvent.parse(e.payload))),
};
