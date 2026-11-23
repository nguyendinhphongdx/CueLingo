import { PRIVACY_PANES } from '../lib/native';
import { currentOs, privacyPanes, type DesktopOs } from '../lib/platform';

export type CaptureStream = 'mic' | 'system';

/** Why the microphone is not recording, when the sidecar says it is a permission: macOS has not asked yet, or the answer was no. */
export type MicPermissionProblem = 'denied' | 'undetermined';

export interface CaptureFailures {
  micFailed: boolean;
  systemFailed: boolean;
  /** Set together with `micFailed` when the cause is the microphone permission. */
  micPermission?: MicPermissionProblem | null;
}

export const MIC_BLOCKED_BUTTON = 'Mở cài đặt Micro';

/** The fixed `status` messages the sidecar sends about the microphone permission (`SidecarProtocol.swift`). */
const MIC_PERMISSION_MESSAGES: Record<string, MicPermissionProblem | 'authorized'> = {
  'microphone: not authorized (denied)': 'denied',
  'microphone: not authorized (undetermined)': 'undetermined',
  'microphone: authorized': 'authorized',
};

/** What a sidecar status message says about the microphone permission; null for any other message. */
export function micPermissionOf(
  message: string | undefined,
): MicPermissionProblem | 'authorized' | null {
  return (message && MIC_PERMISSION_MESSAGES[message]) || null;
}

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
export function describeCaptureProblems(
  { micFailed, systemFailed, micPermission }: CaptureFailures,
  os: DesktopOs = currentOs(),
): CaptureBanner | null {
  if (os === 'windows') return describeWindowsProblems({ micFailed, systemFailed });
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
  if (micFailed && micPermission) {
    return {
      message:
        micPermission === 'undetermined'
          ? 'Micro chưa được cấp quyền. macOS đang hỏi, hãy bấm Cho phép. Caption âm thanh hệ thống vẫn chạy.'
          : 'Micro chưa được cấp quyền. Bật CueLingo trong mục Micro của Cài đặt hệ thống rồi bắt đầu lại. Caption âm thanh hệ thống vẫn chạy.',
      buttonLabel: 'Mở Cài đặt',
      pane: PRIVACY_PANES.microphone,
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

/** The fix for one stream that failed to start, for the stream's own row; null when it did not fail. */
export function describeStream(
  stream: CaptureStream,
  failures: CaptureFailures,
  os: DesktopOs = currentOs(),
): CaptureBanner | null {
  const failed = stream === 'mic' ? failures.micFailed : failures.systemFailed;
  if (!failed) return null;
  // Asked about one stream only, so the answer never talks about the other one.
  return describeCaptureProblems(
    {
      micFailed: stream === 'mic',
      systemFailed: stream === 'system',
      micPermission: stream === 'mic' ? failures.micPermission : null,
    },
    os,
  );
}

/** Windows has no "record system audio" permission: the system stream fails for a device reason, so the page is Sound. */
function describeWindowsProblems({
  micFailed,
  systemFailed,
}: CaptureFailures): CaptureBanner | null {
  const panes = privacyPanes('windows');
  if (micFailed && systemFailed) {
    return {
      message:
        'Không thu được âm thanh nào. Hãy bật quyền Micro cho CueLingo trong Cài đặt Windows, kiểm tra thiết bị phát âm thanh mặc định rồi bắt đầu lại.',
      buttonLabel: MIC_BLOCKED_BUTTON,
      pane: panes.microphone,
    };
  }
  if (systemFailed) {
    return {
      message:
        'Không thu được âm thanh hệ thống (tiếng của người trong cuộc họp). Windows không đòi cấp quyền cho phần này: hãy kiểm tra thiết bị phát âm thanh mặc định rồi dừng và bắt đầu lại.',
      buttonLabel: 'Mở cài đặt Âm thanh',
      pane: panes.systemAudio,
    };
  }
  if (micFailed) {
    return {
      message:
        'Không mở được micro (giọng của bạn). Hãy bật quyền Micro cho CueLingo trong Cài đặt Windows rồi dừng và bắt đầu lại.',
      buttonLabel: MIC_BLOCKED_BUTTON,
      pane: panes.microphone,
    };
  }
  return null;
}

/** What a meter says about its stream: a fault only when the sidecar reported one, never from silence. */
export function meterNote(failed: boolean, silent: boolean): 'failed' | 'silent' | null {
  return failed ? 'failed' : silent ? 'silent' : null;
}

export type StartDecision = 'start' | 'ask-consent';

/**
 * What Bắt đầu does first. A missing microphone permission no longer blocks it: the meeting starts, the system
 * audio is captioned, and a banner says what is missing (the sidecar reports it, see `micPermissionOf`).
 */
export function decideStart(input: { needsConsent: boolean }): StartDecision {
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
