import { describe, expect, it } from 'vitest';
import type { ModelStatus } from '../lib/native';
import {
  applyModelEvent,
  canContinue,
  gateAction,
  deviceLanguages,
  describeDownloadError,
  formatSize,
  transientOf,
  viewOf,
} from './model-state';

const status = (state: 'ready' | 'missing'): ModelStatus => ({
  type: 'models',
  models: [{ language: 'en', state, sizeBytes: 661_288_526 }],
});

describe('viewOf', () => {
  it('says ready or missing from what is on disk', () => {
    expect(viewOf('en', status('ready'))).toEqual({ kind: 'ready', sizeBytes: 661_288_526 });
    expect(viewOf('en', status('missing'))).toEqual({ kind: 'missing', sizeBytes: 661_288_526 });
  });

  it('is checking until the first answer comes', () => {
    expect(viewOf('en', undefined)).toEqual({ kind: 'checking' });
  });

  it('is null when this build cannot manage models, so a screen keeps the old flow', () => {
    expect(viewOf('en', null)).toBeNull();
  });

  it('needs no model for a language recognised in the cloud, whatever the status says', () => {
    for (const language of ['ja', 'ko', 'zh', 'vi']) {
      expect(viewOf(language, status('missing'))).toEqual({ kind: 'cloud' });
      expect(viewOf(language, null)).toEqual({ kind: 'cloud' });
    }
  });

  it('shows a running download over the disk state, with its progress', () => {
    expect(viewOf('en', status('missing'), { state: 'downloading', progress: 0.4 })).toEqual({
      kind: 'downloading',
      sizeBytes: 661_288_526,
      progress: 0.4,
    });
    expect(viewOf('en', undefined, { state: 'downloading' })).toMatchObject({
      kind: 'downloading',
      progress: 0,
    });
  });

  it('shows a failed download with fixed Vietnamese text, never the sidecar message', () => {
    const view = viewOf('en', status('missing'), {
      state: 'error',
      message: 'C:\\Users\\someone\\a.onnx',
    });
    expect(view).toMatchObject({ kind: 'error' });
    expect(JSON.stringify(view)).not.toContain('someone');
  });

  it('a download that just finished is ready even before the status is read again', () => {
    expect(viewOf('en', status('missing'), { state: 'ready' })).toEqual({
      kind: 'ready',
      sizeBytes: 661_288_526,
    });
  });
});

describe('canContinue (the onboarding step)', () => {
  it('is blocked until the model is in place', () => {
    expect(canContinue({ kind: 'missing', sizeBytes: 1 })).toBe(false);
    expect(canContinue({ kind: 'downloading', sizeBytes: 1, progress: 0.5 })).toBe(false);
    expect(canContinue({ kind: 'error', sizeBytes: 1, message: 'x' })).toBe(false);
    expect(canContinue({ kind: 'checking' })).toBe(false);
  });

  it('is open when the model is in place, or this build does not manage models', () => {
    expect(canContinue({ kind: 'ready', sizeBytes: 1 })).toBe(true);
    expect(canContinue(null)).toBe(true);
  });
});

describe('formatSize', () => {
  it('writes whole megabytes, and gigabytes from 1024 MB', () => {
    expect(formatSize(661_288_526)).toBe('631 MB');
    expect(formatSize(1)).toBe('1 MB');
    expect(formatSize(3 * 1024 ** 3)).toBe('3,0 GB');
  });
});

describe('describeDownloadError', () => {
  it('gives a short Vietnamese reason', () => {
    expect(describeDownloadError('download of a.onnx failed: io: refused')).toContain('mạng');
    expect(describeDownloadError('sha-256 does not match')).toContain('hỏng');
    expect(describeDownloadError('download interrupted')).toContain('gián đoạn');
    expect(describeDownloadError(undefined)).toContain('mạng');
  });
});

describe('transientOf and the registry', () => {
  it('keeps what the event said', () => {
    expect(transientOf({ language: 'en', state: 'downloading', progress: 0.1 })).toEqual({
      state: 'downloading',
      progress: 0.1,
      message: undefined,
    });
  });

  it('lists only the languages that run on this machine', () => {
    expect(deviceLanguages()).toEqual(['en']);
  });
});

describe('applyModelEvent', () => {
  it('keeps the last thing said per language', () => {
    const next = applyModelEvent({}, { language: 'en', state: 'downloading', progress: 0.3 });
    expect(next.en).toMatchObject({ state: 'downloading', progress: 0.3 });
    expect(applyModelEvent(next, { language: 'en', state: 'ready' }).en?.state).toBe('ready');
  });

  it('forgets a cancelled download: it goes back to what is on disk, not to an error', () => {
    const before = { en: { state: 'downloading', progress: 0.6 }, vi: { state: 'ready' } } as const;
    const next = applyModelEvent(before, {
      language: 'en',
      state: 'error',
      message: 'cancelled',
    });
    expect(next).toEqual({ vi: { state: 'ready' } });
  });

  it('still shows a real failure', () => {
    const next = applyModelEvent({}, { language: 'en', state: 'error', message: 'offline' });
    expect(next.en?.state).toBe('error');
  });
});

describe('gateAction (starting a meeting)', () => {
  it('goes on when the model is there, needs none, or the app does not manage models', () => {
    expect(gateAction({ kind: 'ready', sizeBytes: 1 }, false)).toBe('begin');
    expect(gateAction({ kind: 'cloud' }, false)).toBe('begin');
    expect(gateAction(null, false)).toBe('begin');
  });

  it('begins the download once when the model is missing', () => {
    expect(gateAction({ kind: 'missing', sizeBytes: 1 }, false)).toBe('download');
    expect(gateAction({ kind: 'missing', sizeBytes: 1 }, true)).toBe('wait');
  });

  it('waits while a download runs, the status is read, or a failure is left to the person', () => {
    expect(gateAction({ kind: 'downloading', sizeBytes: 1, progress: 0.1 }, false)).toBe('wait');
    expect(gateAction({ kind: 'checking' }, false)).toBe('wait');
    expect(gateAction({ kind: 'error', sizeBytes: 1, message: 'x' }, false)).toBe('wait');
  });
});
