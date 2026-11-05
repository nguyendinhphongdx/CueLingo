import type { UpdateOffer } from '../lib/native';

export const UPDATE_CHECK_MS = 6 * 60 * 60 * 1000;

export type UpdateState =
  | { phase: 'none' }
  | { phase: 'available'; version: string; notes: string | null }
  | { phase: 'installing'; version: string }
  | { phase: 'failed'; version: string; reason: 'signature' | 'other' };

export interface UpdateDeps {
  check(): Promise<UpdateOffer | null>;
  /** True while a meeting runs or is draining: an update restarts the app, so it must wait. */
  meetingActive(): boolean;
}

/** Looks for a newer build on open and every few hours; never installs by itself, never during a meeting. */
export function createUpdateController(deps: UpdateDeps) {
  let state: UpdateState = { phase: 'none' };
  let offer: UpdateOffer | null = null;
  let checking = false;
  const listeners = new Set<() => void>();

  const set = (next: UpdateState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async check() {
      if (checking || state.phase === 'installing') return;
      checking = true;
      try {
        offer = await deps.check();
        if (offer) set({ phase: 'available', version: offer.version, notes: offer.notes });
        else if (state.phase === 'available') set({ phase: 'none' });
      } catch {
        // A failed check is silent: the next one is a few hours away, and nothing is broken.
      } finally {
        checking = false;
      }
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
