import type { LearningEvent } from '@cuelingo/shared';

/**
 * The two activation events of the beta (spec AC7): when the app was first opened and when its first real
 * caption appeared. Neither carries caption text. The clock starts at the first launch, so it is kept on
 * this Mac even before anyone signs in, and sent once per person after sign-in.
 */
const FIRST_RUN_AT = 'cuelingo.firstRunAt';
const firstRunSentKey = (userId: string) => `cuelingo.firstRunSent.${userId}`;
const firstCaptionSentKey = (userId: string) => `cuelingo.firstCaptionSent.${userId}`;

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Activation {
  /** Remembers the first launch (once, ever, on this Mac). */
  recordLaunch(): void;
  /** Sends `app_installed_first_run` for this person if it was not sent before. */
  signedIn(userId: string): Promise<void>;
  signedOut(): void;
  /** The first final caption of a real meeting; sent once per person. */
  captionShown(sessionId: string): Promise<void>;
}

export function createActivation({
  store,
  record,
  now = () => new Date(),
}: {
  store: KeyValueStore;
  record(event: LearningEvent): Promise<void>;
  now?: () => Date;
}): Activation {
  let userId: string | null = null;
  // Storage can be unavailable (private mode, quota); a missing record must never break the app.
  const read = (key: string) => {
    try {
      return store.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key: string, value: string) => {
    try {
      store.setItem(key, value);
    } catch {
      /* ignored on purpose */
    }
  };

  return {
    recordLaunch() {
      if (!read(FIRST_RUN_AT)) write(FIRST_RUN_AT, now().toISOString());
    },
    async signedIn(id) {
      userId = id;
      const firstRunAt = read(FIRST_RUN_AT);
      if (!firstRunAt || read(firstRunSentKey(id))) return;
      try {
        await record({ type: 'app_installed_first_run', at: firstRunAt });
        write(firstRunSentKey(id), '1');
      } catch {
        // Tried again at the next launch.
      }
    },
    signedOut() {
      userId = null;
    },
    async captionShown(sessionId) {
      const id = userId;
      if (!id || read(firstCaptionSentKey(id))) return;
      // Mark first: a second caption a moment later must not send a second event while this one is in flight.
      write(firstCaptionSentKey(id), '1');
      try {
        await record({ type: 'first_caption_shown', sessionId, at: now().toISOString() });
      } catch {
        try {
          localStorage.removeItem(firstCaptionSentKey(id));
        } catch {
          /* ignored on purpose */
        }
      }
    },
  };
}
