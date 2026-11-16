import { describe, expect, it } from 'vitest';
import { isCompiled, markCompiled, modelState, modelStepPlan } from './model-state';

const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
};

describe('modelStepPlan', () => {
  it('downloads for an on-device language and skips the cloud ones', () => {
    expect(modelStepPlan('en')).toBe('download');
    expect(modelStepPlan('vi')).toBe('cloud');
  });
});

describe('modelState', () => {
  const base = {
    language: 'en' as const,
    status: 'missing' as const,
    compiled: false,
    event: null,
  };

  it('says cloud for Vietnamese whatever the disk says', () => {
    expect(modelState({ ...base, language: 'vi', status: 'missing' })).toBe('cloud');
  });

  it('reads the disk when no download is going', () => {
    expect(modelState({ ...base, status: null })).toBe('unknown');
    expect(modelState(base)).toBe('missing');
    expect(modelState({ ...base, status: 'cached' })).toBe('cached');
    expect(modelState({ ...base, status: 'cached', compiled: true })).toBe('ready');
    expect(modelState({ ...base, status: 'ready' })).toBe('ready');
  });

  it('follows the native events for this language, finishing download as compiling', () => {
    const event = (state: 'downloading' | 'ready' | 'error', progress?: number) => ({
      type: 'model' as const,
      language: 'en',
      state,
      progress,
    });
    expect(modelState({ ...base, event: event('downloading', 0.3) })).toBe('downloading');
    expect(modelState({ ...base, event: event('downloading', 1) })).toBe('compiling');
    expect(modelState({ ...base, event: event('ready') })).toBe('ready');
    expect(modelState({ ...base, event: event('error') })).toBe('error');
    // An event for another language says nothing about this one.
    expect(modelState({ ...base, event: { ...event('error'), language: 'ja' } })).toBe('missing');
  });
});

describe('compiled marker', () => {
  it('is per app version and language, and old versions drop out', () => {
    const store = memory();
    expect(isCompiled('0.1.6', 'en', store)).toBe(false);
    markCompiled('0.1.6', 'en', store);
    expect(isCompiled('0.1.6', 'en', store)).toBe(true);
    expect(isCompiled('0.1.7', 'en', store)).toBe(false);
    markCompiled('0.1.7', 'en', store);
    expect(isCompiled('0.1.6', 'en', store)).toBe(false);
    expect(isCompiled('0.1.7', 'en', store)).toBe(true);
  });

  it('survives blocked storage', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(isCompiled('1', 'en', blocked)).toBe(false);
    expect(() => markCompiled('1', 'en', blocked)).not.toThrow();
    expect(isCompiled('1', 'en', null)).toBe(false);
  });
});
