import type { LanguageCode } from '@cuelingo/shared';

/** Languages with a model on this machine for the fallback (ADR 0024). */
export const OFFLINE_LANGUAGES: readonly LanguageCode[] = ['vi'];
export const hasOfflineModelFor = (language: LanguageCode) => OFFLINE_LANGUAGES.includes(language);

/** Cloud failures in a row that move a meeting to offline recognition. */
export const FAILURES_TO_GO_OFFLINE = 2;
/** While offline, one sentence in this long is tried on the cloud again, to find out when it is back. */
export const CLOUD_PROBE_MS = 15_000;

export type RecognitionMode = 'cloud' | 'local';

/**
 * Which way a meeting recognises its next sentence. Pure bookkeeping: the controller tells it what the cloud
 * did and asks what to try. A sentence that fails on the cloud is always recognised locally as well (when the
 * fallback is on), so a failure never leaves a gap; this only decides whether to wait for the cloud first.
 */
export function createFallbackSwitch() {
  let mode: RecognitionMode = 'cloud';
  let failures = 0;
  let lastProbe = Number.NEGATIVE_INFINITY;
  let pinned = false;
  let probing = false;

  return {
    mode: (): RecognitionMode => mode,
    /** Whether the next sentence should go to the cloud first. */
    shouldTryCloud(now: number): boolean {
      if (mode === 'cloud') return true;
      // One probe at a time: a hung network must not pile probes up and use every upload slot.
      if (pinned || probing || now - lastProbe < CLOUD_PROBE_MS) return false;
      lastProbe = now;
      probing = true;
      return true;
    },
    /** The sentence sent to find out whether the cloud is back has come back, one way or the other. */
    probeEnded() {
      probing = false;
    },
    /** The cloud could not recognise a sentence. Returns true when this is the moment the meeting goes offline. */
    cloudFailed(now: number): boolean {
      failures += 1;
      if (mode === 'local' || failures < FAILURES_TO_GO_OFFLINE) return false;
      mode = 'local';
      lastProbe = now;
      return true;
    },
    /** The cloud recognised a sentence. Returns true when the meeting is back on the cloud. */
    cloudWorked(): boolean {
      failures = 0;
      if (mode === 'cloud' || pinned) return false;
      mode = 'cloud';
      return true;
    },
    /** The cloud will not take more audio this meeting (allowance used up): offline until it ends. */
    pinLocal(): boolean {
      const changed = mode !== 'local';
      mode = 'local';
      pinned = true;
      return changed;
    },
  };
}
export type FallbackSwitch = ReturnType<typeof createFallbackSwitch>;

type FlagStorage = Pick<Storage, 'getItem' | 'setItem'>;
const FLAG_KEY = 'cuelingo.offline-stt.v1';

/** Whether the person turned the offline fallback on (off by default; ADR 0024). The model is on the device, so is the choice. */
export function isOfflineFallbackOn(storage?: FlagStorage): boolean {
  try {
    return (storage ?? globalThis.localStorage).getItem(FLAG_KEY) === 'on';
  } catch {
    return false;
  }
}

export function setOfflineFallbackOn(on: boolean, storage?: FlagStorage) {
  try {
    (storage ?? globalThis.localStorage).setItem(FLAG_KEY, on ? 'on' : 'off');
  } catch {
    // The choice only lasts for this run when storage is unavailable.
  }
}
