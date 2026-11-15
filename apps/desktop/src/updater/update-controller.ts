import type { UpdateOffer } from '../lib/native';

export const UPDATE_CHECK_MS = 6 * 60 * 60 * 1000;

export type UpdateState =
  | { phase: 'none' }
  | { phase: 'available'; version: string; notes: string | null }
  | { phase: 'installing'; version: string }
  | { phase: 'failed'; version: string; reason: 'signature' | 'other' };

/** The answer to a check the person asked for; background checks never set it. */
export type ManualCheck =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'upToDate'; at: Date }
  | { status: 'unsupported' }
  | { status: 'error' };

export interface UpdateDeps {
  check(): Promise<UpdateOffer | null | 'unsupported'>;
  /** True while a meeting runs or is draining: an update restarts the app, so it must wait. */
  meetingActive(): boolean;
}

/** Looks for a newer build on open and every few hours; never installs by itself, never during a meeting. */
export function createUpdateController(deps: UpdateDeps) {
  let state: UpdateState = { phase: 'none' };
  let manual: ManualCheck = { status: 'idle' };
  let offer: UpdateOffer | null = null;
  let running: Promise<'none' | 'unsupported' | 'error'> | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  const set = (next: UpdateState) => {
    state = next;
    notify();
  };
  const setManual = (next: ManualCheck) => {
    manual = next;
    notify();
  };

  /** One request at a time: a click during a background check waits for that check's answer. */
  const run = () => {
    running ??= (async () => {
      try {
        const found = await deps.check();
        if (found === 'unsupported') return 'unsupported' as const;
        offer = found;
        if (offer) set({ phase: 'available', version: offer.version, notes: offer.notes });
        else if (state.phase === 'available') set({ phase: 'none' });
        return 'none' as const;
      } catch {
        return 'error' as const;
      } finally {
        running = null;
      }
    })();
    return running;
  };

  return {
    getState: () => state,
    getManual: () => manual,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Background check: a failure is silent, the next one is a few hours away and nothing is broken. */
    async check() {
      if (state.phase === 'installing') return;
      await run();
    },
    /** The person pressed "Kiểm tra cập nhật": every outcome is reported. */
    async checkNow() {
      if (state.phase === 'installing') return;
      setManual({ status: 'checking' });
      const outcome = await run();
      if (outcome === 'unsupported') setManual({ status: 'unsupported' });
      else if (outcome === 'error') setManual({ status: 'error' });
      else if (offer) setManual({ status: 'idle' });
      else setManual({ status: 'upToDate', at: new Date() });
    },
    async install() {
      if (!offer || state.phase === 'installing' || deps.meetingActive()) return;
      const version = offer.version;
      set({ phase: 'installing', version });
      try {
        await offer.install();
      } catch (error) {
        set({
          phase: 'failed',
          version,
          reason: /signature/i.test(String(error)) ? 'signature' : 'other',
        });
      }
    },
    dismiss() {
      if (state.phase === 'failed') set({ phase: 'none' });
    },
  };
}

export type UpdateController = ReturnType<typeof createUpdateController>;
