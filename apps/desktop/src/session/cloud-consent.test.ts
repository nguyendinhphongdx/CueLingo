import { describe, expect, it } from 'vitest';
import { cloudConsentKey, grantCloudConsent, hasCloudConsent } from './cloud-consent';

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('cloud consent', () => {
  it('is missing until granted, and kept per user', () => {
    const storage = memory();
    expect(hasCloudConsent('a1', storage)).toBe(false);
    grantCloudConsent('a1', storage);
    expect(storage.data.get(cloudConsentKey('a1'))).toBe('true');
    expect(hasCloudConsent('a1', storage)).toBe(true);
    expect(hasCloudConsent('b2', memory())).toBe(false);
  });

  it('survives unavailable storage', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(hasCloudConsent('c3', broken)).toBe(false);
    expect(() => grantCloudConsent('c3', broken)).not.toThrow();
    // Still granted for this run.
    expect(hasCloudConsent('c3', broken)).toBe(true);
  });
});
