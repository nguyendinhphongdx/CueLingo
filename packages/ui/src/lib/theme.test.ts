import { describe, expect, it } from 'vitest';
import {
  isDark,
  parseThemeMode,
  readThemeMode,
  storeThemeMode,
  subscribeThemeMode,
  THEME_STORAGE_KEY,
} from './theme';

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
};

describe('theme mode', () => {
  it('defaults to the system and ignores anything unknown', () => {
    expect(parseThemeMode(null)).toBe('system');
    expect(parseThemeMode('blue')).toBe('system');
    expect(parseThemeMode('dark')).toBe('dark');
    expect(readThemeMode(memory())).toBe('system');
  });

  it('follows the system only in system mode', () => {
    expect(isDark('system', true)).toBe(true);
    expect(isDark('system', false)).toBe(false);
    expect(isDark('light', true)).toBe(false);
    expect(isDark('dark', false)).toBe(true);
  });

  it('stores light and dark, clears the key for system, and tells listeners', () => {
    const storage = memory();
    let calls = 0;
    const stop = subscribeThemeMode(() => (calls += 1));
    storeThemeMode('dark', storage);
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe('dark');
    expect(readThemeMode(storage)).toBe('dark');
    storeThemeMode('system', storage);
    expect(storage.data.has(THEME_STORAGE_KEY)).toBe(false);
    expect(calls).toBe(2);
    stop();
  });

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readThemeMode(broken)).toBe('system');
    expect(() => storeThemeMode('dark', broken)).not.toThrow();
  });
});
