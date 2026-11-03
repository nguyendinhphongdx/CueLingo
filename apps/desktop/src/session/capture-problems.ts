import { PRIVACY_PANES, type PermissionsStatus } from '../lib/native';

export type CaptureStream = 'mic' | 'system';

export interface CaptureFailures {
  micFailed: boolean;
  systemFailed: boolean;
}

export const MIC_BLOCKED_TEXT =
  'Micro đang bị chặn cho CueLingo. Hãy cấp quyền Micro rồi bắt đầu lại.';
export const MIC_BLOCKED_BUTTON = 'Mở cài đặt Micro';

/** Which capture a sidecar error message is about; null for any other error (model load, transcribe…). */
export function captureProblemOf(message: string | undefined): CaptureStream | null {
  if (message?.startsWith('system audio')) return 'system';
  if (message?.startsWith('microphone')) return 'mic';
  return null;
}

export interface CaptureBanner {
  message: string;
  buttonLabel: string;
  /** Privacy pane to open; both streams failing points at the system-audio pane. */
  pane: string;
}

/** The warning for what failed to start, or null when nothing did. */
export function describeCaptureProblems({
  micFailed,
  systemFailed,
}: CaptureFailures): CaptureBanner | null {
  if (micFailed && systemFailed) {
    return {
      message: 'Không thu được âm thanh nào. Hãy cấp quyền rồi bắt đầu lại.',
      buttonLabel: 'Mở cài đặt',
      pane: PRIVACY_PANES.systemAudio,
    };
  }
  if (systemFailed) {
    return {
      message:
        'Không thu được âm thanh hệ thống (tiếng của người trong cuộc họp). Cấp quyền Ghi âm thanh hệ thống cho CueLingo rồi dừng và bắt đầu lại.',
      buttonLabel: 'Mở cài đặt',
      pane: PRIVACY_PANES.systemAudio,
    };
  }
  if (micFailed) {
    return {
      message:
        'Không mở được micro (giọng của bạn). Cấp quyền Micro cho CueLingo rồi dừng và bắt đầu lại.',
      buttonLabel: MIC_BLOCKED_BUTTON,
      pane: PRIVACY_PANES.microphone,
    };
  }
  return null;
}

/** What a meter says about its stream: a fault only when the sidecar reported one, never from silence. */
export function meterNote(failed: boolean, silent: boolean): 'failed' | 'silent' | null {
  return failed ? 'failed' : silent ? 'silent' : null;
}

/** Whether Bắt đầu may go on. Only a denied microphone blocks; any other answer (or a failed read) lets macOS or the sidecar speak. */
export async function canStartMeeting(
  read: () => Promise<PermissionsStatus>,
): Promise<'ok' | 'mic-denied'> {
  try {
    return (await read()).microphone === 'denied' ? 'mic-denied' : 'ok';
  } catch {
    return 'ok';
  }
}

export type StartDecision = 'start' | 'ask-consent' | 'mic-denied';

/**
 * What Bắt đầu does first. The microphone is checked before the consent dialog, so a blocked
 * microphone never leads to a saved consent for a meeting that did not run.
 */
export async function decideStart(input: {
  needsConsent: boolean;
  readPermissions: () => Promise<PermissionsStatus>;
}): Promise<StartDecision> {
  if ((await canStartMeeting(input.readPermissions)) === 'mic-denied') return 'mic-denied';
  return input.needsConsent ? 'ask-consent' : 'start';
}

/** Meeting time in ms; stops at `endedAt` once the person pressed Stop. */
export function elapsedMs(startedAt: number | null, endedAt: number | null, now: number): number {
  if (startedAt === null) return 0;
  return Math.max(0, (endedAt ?? now) - startedAt);
}

/** mm:ss, or h:mm:ss from one hour. */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  const hours = Math.floor(seconds / 3600);
  const rest = `${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
  return hours > 0 ? `${hours}:${rest}` : rest;
}
