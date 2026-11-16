import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PRIVACY_PANES } from '../lib/native';
import {
  captureProblemOf,
  decideStart,
  describeCaptureProblems,
  describeStream,
  elapsedMs,
  formatDuration,
  meterNote,
  micPermissionOf,
} from './capture-problems';
import {
  AudioLevelRows,
  CAPTURE_FAILED_TEXT,
  LISTENING_TEXT,
  NO_SIGNAL_TEXT,
} from './SessionPanel';

vi.mock('../lib/native', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  native: {},
}));

describe('microphone permission messages', () => {
  it('reads the three fixed sidecar messages and nothing else', () => {
    expect(micPermissionOf('microphone: not authorized (denied)')).toBe('denied');
    expect(micPermissionOf('microphone: not authorized (undetermined)')).toBe('undetermined');
    expect(micPermissionOf('microphone: authorized')).toBe('authorized');
    expect(micPermissionOf('microphone: engine failed')).toBeNull();
    expect(micPermissionOf('system audio: tap failed')).toBeNull();
    expect(micPermissionOf(undefined)).toBeNull();
  });

  it('still counts the permission messages as a microphone problem', () => {
    expect(captureProblemOf('microphone: not authorized (denied)')).toBe('mic');
  });

  it('names the microphone settings pane as the fix for a blocked microphone', () => {
    const fix = describeStream('mic', { micFailed: true, systemFailed: false }, 'macos')!;
    expect(fix.buttonLabel).toBe('Mở cài đặt Micro');
    expect(fix.pane).toBe(PRIVACY_PANES.microphone);
    expect(PRIVACY_PANES.microphone).toBe(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
    );
  });

  it('says the microphone is not allowed, offers Settings and keeps system captions running', () => {
    const denied = describeCaptureProblems({
      micFailed: true,
      systemFailed: false,
      micPermission: 'denied',
    })!;
    expect(denied.message).toContain('Micro chưa được cấp quyền');
    expect(denied.message).toContain('âm thanh hệ thống vẫn chạy');
    expect(denied.buttonLabel).toBe('Mở Cài đặt');
    expect(denied.pane).toBe(PRIVACY_PANES.microphone);
    const asking = describeCaptureProblems({
      micFailed: true,
      systemFailed: false,
      micPermission: 'undetermined',
    })!;
    expect(asking.message).toContain('Micro chưa được cấp quyền');
    expect(asking.message).toContain('bấm Cho phép');
    expect(asking.buttonLabel).toBe('Mở Cài đặt');
  });

  it('keeps the both-failed message when the system audio failed too', () => {
    const both = describeCaptureProblems({
      micFailed: true,
      systemFailed: true,
      micPermission: 'denied',
    })!;
    expect(both.message).toContain('Không thu được âm thanh nào');
  });

  it('puts the permission message on the microphone row, and only there', () => {
    const failures = { micFailed: true, systemFailed: false, micPermission: 'denied' as const };
    expect(describeStream('mic', failures, 'macos')!.message).toContain('Micro chưa được cấp quyền');
    expect(describeStream('system', failures, 'macos')).toBeNull();
  });
});

describe('capture problems', () => {
  it('maps error message prefixes to a stream', () => {
    expect(captureProblemOf('system audio: tap failed')).toBe('system');
    expect(captureProblemOf('microphone: denied')).toBe('mic');
    expect(captureProblemOf('model load failed for vi')).toBeNull();
    expect(captureProblemOf(undefined)).toBeNull();
  });

  it('picks the banner and pane for each case', () => {
    expect(describeCaptureProblems({ micFailed: false, systemFailed: false })).toBeNull();
    const system = describeCaptureProblems({ micFailed: false, systemFailed: true })!;
    expect(system.message).toContain('Không thu được âm thanh hệ thống');
    expect(system.pane).toBe(PRIVACY_PANES.systemAudio);
    const mic = describeCaptureProblems({ micFailed: true, systemFailed: false })!;
    expect(mic.message).toContain('Không mở được micro');
    expect(mic.pane).toBe(PRIVACY_PANES.microphone);
    const both = describeCaptureProblems({ micFailed: true, systemFailed: true })!;
    expect(both.message).toBe('Không thu được âm thanh nào. Hãy cấp quyền rồi bắt đầu lại.');
  });

  it('on Windows points at the Microsoft pages and never asks for a system-audio permission', () => {
    const none = { micFailed: false, systemFailed: false };
    expect(describeCaptureProblems(none, 'windows')).toBeNull();
    const system = describeCaptureProblems({ micFailed: false, systemFailed: true }, 'windows')!;
    expect(system.pane).toBe('ms-settings:sound');
    expect(system.message).toContain('không đòi cấp quyền');
    expect(system.message).not.toContain('macOS');
    const mic = describeCaptureProblems({ micFailed: true, systemFailed: false }, 'windows')!;
    expect(mic.pane).toBe('ms-settings:privacy-microphone');
    expect(mic.message).toContain('Cài đặt Windows');
    const both = describeCaptureProblems({ micFailed: true, systemFailed: true }, 'windows')!;
    expect(both.pane).toBe('ms-settings:privacy-microphone');
  });

  it('shows a fault only for a reported failure, never for silence', () => {
    expect(meterNote(true, true)).toBe('failed');
    expect(meterNote(true, false)).toBe('failed');
    expect(meterNote(false, true)).toBe('silent');
    expect(meterNote(false, false)).toBeNull();
  });

  const base = { mic: [], system: [], micSilent: false, systemSilent: false };
  const ok = { micFailed: false, systemFailed: false };

  it('gives each stream its own state: a failed one shows a fix, the other keeps listening', () => {
    const markup = renderToStaticMarkup(
      <AudioLevelRows
        levels={{ ...base, systemSilent: true }}
        failures={{ micFailed: true, systemFailed: false }}
      />,
    );
    expect(markup).toMatch(/data-stream="mic" data-state="failed"/);
    expect(markup).toMatch(/data-stream="system" data-state="silent"/);
    expect(markup).toContain(CAPTURE_FAILED_TEXT);
    expect(markup).toContain('Mở cài đặt Micro');
    expect(markup.match(/role="alert"/g)).toHaveLength(1);
    expect(NO_SIGNAL_TEXT).toBe('Chưa có âm thanh');
  });

  it('shows the system stream failing while the microphone keeps listening', () => {
    const markup = renderToStaticMarkup(
      <AudioLevelRows levels={base} failures={{ micFailed: false, systemFailed: true }} />,
    );
    expect(markup).toMatch(/data-stream="system" data-state="failed"/);
    expect(markup).toMatch(/data-stream="mic" data-state="listening"/);
    expect(markup).toContain(LISTENING_TEXT);
    expect(markup).toContain('Không thu được âm thanh hệ thống');
  });

  it('says the microphone is off instead of "no sound" while the other stream keeps listening', () => {
    const markup = renderToStaticMarkup(
      <AudioLevelRows levels={{ ...base, micSilent: true }} failures={ok} micMuted />,
    );
    expect(markup).toMatch(/data-stream="mic" data-state="muted"/);
    expect(markup).toContain('Micro đã tắt');
    expect(markup).not.toContain(NO_SIGNAL_TEXT);
    expect(markup).toMatch(/data-stream="system" data-state="listening"/);
  });

  it('shows only the soft label when the streams are merely silent', () => {
    const markup = renderToStaticMarkup(
      <AudioLevelRows levels={{ ...base, micSilent: true, systemSilent: true }} failures={ok} />,
    );
    expect(markup).not.toContain(CAPTURE_FAILED_TEXT);
    expect(markup).not.toContain('role="alert"');
    expect(markup.match(/Chưa có âm thanh/g)).toHaveLength(2);
  });

  it('describes a stream only when it failed', () => {
    expect(describeStream('mic', ok)).toBeNull();
    expect(describeStream('system', { micFailed: true, systemFailed: false })).toBeNull();
    expect(describeStream('system', { micFailed: false, systemFailed: true })!.pane).toBe(
      PRIVACY_PANES.systemAudio,
    );
  });
});

describe('start decision', () => {
  it('never blocks on the microphone: it only asks for consent when the language needs it', () => {
    expect(decideStart({ needsConsent: true })).toBe('ask-consent');
    expect(decideStart({ needsConsent: false })).toBe('start');
  });
});

describe('meeting time', () => {
  it('counts to now while running and freezes at endedAt', () => {
    expect(elapsedMs(null, null, 5_000)).toBe(0);
    expect(elapsedMs(1_000, null, 5_000)).toBe(4_000);
    expect(elapsedMs(1_000, 3_000, 9_000)).toBe(2_000);
  });

  it('formats mm:ss and h:mm:ss', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65_000)).toBe('01:05');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });
});
