import { describe, expect, it } from 'vitest';
import {
  CLOUD_PROBE_MS,
  FAILURES_TO_GO_OFFLINE,
  createFallbackSwitch,
  hasOfflineModelFor,
  isOfflineFallbackOn,
  setOfflineFallbackOn,
} from './offline-fallback';

describe('fallback switch', () => {
  it('stays on the cloud for the first failure and goes offline on the second in a row', () => {
    const s = createFallbackSwitch();
    expect(s.cloudFailed(0)).toBe(false);
    expect(s.mode()).toBe('cloud');
    expect(s.cloudFailed(1)).toBe(true);
    expect(FAILURES_TO_GO_OFFLINE).toBe(2);
    expect(s.mode()).toBe('local');
    expect(s.cloudFailed(2)).toBe(false); // already offline: nothing to announce again
  });

  it('forgets earlier failures once the cloud works', () => {
    const s = createFallbackSwitch();
    s.cloudFailed(0);
    s.cloudWorked();
    expect(s.cloudFailed(1)).toBe(false);
    expect(s.mode()).toBe('cloud');
  });

  it('tries the cloud first while on it, and only now and then while offline', () => {
    const s = createFallbackSwitch();
    expect(s.shouldTryCloud(0)).toBe(true);
    s.cloudFailed(0);
    s.cloudFailed(1);
    expect(s.shouldTryCloud(2)).toBe(false);
    expect(s.shouldTryCloud(1 + CLOUD_PROBE_MS)).toBe(true); // one probe
    s.probeEnded();
    expect(s.shouldTryCloud(2 + CLOUD_PROBE_MS)).toBe(false); // the next waits its turn
    expect(s.shouldTryCloud(1 + 2 * CLOUD_PROBE_MS)).toBe(true);
  });

  it('sends one probe at a time until it comes back', () => {
    const s = createFallbackSwitch();
    s.cloudFailed(0);
    s.cloudFailed(1);
    expect(s.shouldTryCloud(1 + CLOUD_PROBE_MS)).toBe(true);
    expect(s.shouldTryCloud(1 + 3 * CLOUD_PROBE_MS)).toBe(false); // the first has not come back
    s.probeEnded();
    expect(s.shouldTryCloud(1 + 3 * CLOUD_PROBE_MS)).toBe(true);
  });

  it('comes back to the cloud when a probe works', () => {
    const s = createFallbackSwitch();
    s.cloudFailed(0);
    s.cloudFailed(1);
    expect(s.cloudWorked()).toBe(true);
    expect(s.mode()).toBe('cloud');
    expect(s.cloudWorked()).toBe(false);
  });

  it('never tries the cloud again once pinned offline (allowance used up)', () => {
    const s = createFallbackSwitch();
    expect(s.pinLocal()).toBe(true);
    expect(s.shouldTryCloud(10 * CLOUD_PROBE_MS)).toBe(false);
    expect(s.cloudWorked()).toBe(false);
    expect(s.mode()).toBe('local');
    expect(s.pinLocal()).toBe(false);
  });
});

describe('fallback flag', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
  };

  it('is off until the person turns it on', () => {
    const storage = memory();
    expect(isOfflineFallbackOn(storage)).toBe(false);
    setOfflineFallbackOn(true, storage);
    expect(isOfflineFallbackOn(storage)).toBe(true);
    setOfflineFallbackOn(false, storage);
    expect(isOfflineFallbackOn(storage)).toBe(false);
  });

  it('reads as off when storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(isOfflineFallbackOn(broken)).toBe(false);
    expect(() => setOfflineFallbackOn(true, broken)).not.toThrow();
  });

  it('has a model for Vietnamese only', () => {
    expect(hasOfflineModelFor('vi')).toBe(true);
    expect(hasOfflineModelFor('en')).toBe(false);
  });
});
