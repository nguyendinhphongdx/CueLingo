import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PermissionsStatus } from '../lib/native';
import { PRIVACY_PANES } from '../lib/native';
import { describeReadiness, startLabel } from '../session/readiness';
import { ReadinessList } from '../session/ReadinessList';

vi.mock('../lib/native', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  native: {},
}));

const permissions = (
  microphone: PermissionsStatus['microphone'],
  systemAudio: PermissionsStatus['systemAudio'] = 'unknown',
): PermissionsStatus => ({ microphone, systemAudio });

const items = (input: Partial<Parameters<typeof describeReadiness>[0]> = {}) =>
  describeReadiness({
    permissions: permissions('granted', 'granted'),
    systemCheck: null,
    model: null,
    language: 'en',
    os: 'macos',
    ...input,
  });

const render = (list = items()) =>
  renderToStaticMarkup(<ReadinessList items={list} onFix={() => {}} />);

describe('meeting readiness', () => {
  it('lists microphone, system audio and the model, each with its state', () => {
    const list = items();
    expect(list.map((item) => item.id)).toEqual(['microphone', 'systemAudio', 'model']);
    expect(list.every((item) => item.status === 'ok')).toBe(true);
    const markup = render(list);
    expect(markup.match(/data-status="ok"/g)).toHaveLength(3);
    expect(markup).toContain('Mô hình nhận dạng tiếng anh');
  });

  it('gives a missing microphone its own fix and still lets the meeting start without it', () => {
    const list = items({ permissions: permissions('denied', 'granted') });
    const mic = list[0]!;
    expect(mic.status).toBe('error');
    expect(mic.fix).toMatchObject({ kind: 'pane', pane: PRIVACY_PANES.microphone });
    expect(list.slice(1).every((item) => !item.fix)).toBe(true);
    const markup = render(list);
    expect(markup).toContain('Micro chưa được cấp quyền');
    expect(markup).toContain('Caption từ âm thanh hệ thống vẫn chạy');
    expect(markup).toContain('Mở Cài đặt hệ thống');
    expect(startLabel(list)).toBe('Bắt đầu họp, không dùng micro');
    expect(startLabel(items())).toBe('Bắt đầu họp');
  });

  it('offers the test sound for system audio, because macOS never says in advance', () => {
    const list = items({ permissions: permissions('granted', 'unknown') });
    expect(list[1]).toMatchObject({ status: 'warn', fix: { kind: 'test-audio' } });
    expect(items({ systemCheck: 'checking' })[1]!.status).toBe('pending');
    expect(items({ systemCheck: 'silent' })[1]).toMatchObject({
      status: 'error',
      fix: { kind: 'pane', pane: PRIVACY_PANES.systemAudio },
    });
    expect(items({ systemCheck: 'granted' })[1]!.status).toBe('ok');
  });

  it('needs no permission for system audio on Windows', () => {
    const list = items({ os: 'windows', permissions: permissions('granted', 'unknown') });
    expect(list[1]).toMatchObject({ status: 'ok' });
    expect(list[1]!.fix).toBeUndefined();
  });

  it('shows the model download and a retry when it failed', () => {
    const downloading = items({
      model: { type: 'model', language: 'en', state: 'downloading', progress: 0.42 },
    });
    expect(downloading[2]).toMatchObject({ status: 'warn', detail: 'Đang tải 42%' });
    const failed = items({ model: { type: 'model', language: 'en', state: 'error' } });
    expect(failed[2]).toMatchObject({ status: 'error', fix: { kind: 'retry' } });
    // An event about another language says nothing about this one.
    const other = items({ model: { type: 'model', language: 'ja', state: 'error' } });
    expect(other[2]!.status).toBe('ok');
  });

  it('shows a pending row while permissions are still being read', () => {
    expect(items({ permissions: null })[0]!.status).toBe('pending');
  });
});
