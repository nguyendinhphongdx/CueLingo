import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PermissionsStatus } from '../lib/native';
import { PRIVACY_PANES } from '../lib/native';
import {
  canStartMeeting,
  captureProblemOf,
  decideStart,
  describeCaptureProblems,
  elapsedMs,
  formatDuration,
  meterNote,
} from './capture-problems';
import {
  AudioLevelRows,
  CAPTURE_FAILED_TEXT,
  CaptureBanner,
  MicBlockedNotice,
  NO_SIGNAL_TEXT,
} from './SessionPanel';

vi.mock('../lib/native', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  native: {},
}));

const permissions = (microphone: PermissionsStatus['microphone']): PermissionsStatus => ({
  microphone,
  systemAudio: 'unknown',
});

describe('preflight', () => {
  it('blocks only when the microphone is denied', async () => {
    expect(await canStartMeeting(async () => permissions('denied'))).toBe('mic-denied');
    for (const state of ['granted', 'undetermined', 'unknown'] as const) {
      expect(await canStartMeeting(async () => permissions(state))).toBe('ok');
    }
  });

  it('starts when the permission read itself fails', async () => {
    expect(await canStartMeeting(() => Promise.reject(new Error('no native')))).toBe('ok');
  });

  it('offers the microphone settings pane when blocked', () => {
    const markup = renderToStaticMarkup(<MicBlockedNotice />);
    expect(markup).toContain(
      'Micro đang bị chặn cho CueLingo. Hãy cấp quyền Micro rồi bắt đầu lại.',
    );
    expect(markup).toContain('Mở cài đặt Micro');
    expect(PRIVACY_PANES.microphone).toBe(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
    );
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

  it('shows a fault only for a reported failure, never for silence', () => {
    expect(meterNote(true, true)).toBe('failed');
    expect(meterNote(true, false)).toBe('failed');
    expect(meterNote(false, true)).toBe('silent');
    expect(meterNote(false, false)).toBeNull();
  });

  const base = { mic: [], system: [], micSilent: false, systemSilent: false };
  const ok = { micFailed: false, systemFailed: false };

  it('renders a red label for a failed stream and a soft one for silence', () => {
    const markup = renderToStaticMarkup(
      <AudioLevelRows
        levels={{ ...base, systemSilent: true }}
        failures={{ micFailed: true, systemFailed: false }}
      />,
    );
    expect(markup).toContain(`text-red-300">${CAPTURE_FAILED_TEXT}`);
    expect(markup).toContain(`text-white/70">${NO_SIGNAL_TEXT}`);
    expect(NO_SIGNAL_TEXT).toBe('Chưa có âm thanh');
  });

  it('shows only the soft label when the streams are merely silent', () => {
    const markup = renderToStaticMarkup(
      <AudioLevelRows levels={{ ...base, micSilent: true, systemSilent: true }} failures={ok} />,
    );
    expect(markup).not.toContain(CAPTURE_FAILED_TEXT);
    expect(markup.match(/Chưa có âm thanh/g)).toHaveLength(2);
  });

  it('renders no banner without a failure, and an alert with one', () => {
    expect(renderToStaticMarkup(<CaptureBanner failures={ok} />)).toBe('');
    const failed = renderToStaticMarkup(
      <CaptureBanner failures={{ micFailed: false, systemFailed: true }} />,
    );
    expect(failed).toContain('role="alert"');
    expect(failed).toContain('Mở cài đặt');
  });
});

describe('start decision', () => {
  const read = (microphone: PermissionsStatus['microphone']) => async () => permissions(microphone);

  it('checks the microphone before asking for consent', async () => {
    expect(await decideStart({ needsConsent: true, readPermissions: read('denied') })).toBe(
      'mic-denied',
    );
    expect(await decideStart({ needsConsent: true, readPermissions: read('undetermined') })).toBe(
      'ask-consent',
    );
    expect(await decideStart({ needsConsent: false, readPermissions: read('granted') })).toBe(
      'start',
    );
    expect(await decideStart({ needsConsent: false, readPermissions: read('denied') })).toBe(
      'mic-denied',
    );
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
