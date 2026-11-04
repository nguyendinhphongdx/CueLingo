import type { TranscribeResponse } from '@cuelingo/shared';

/** Same cap as the server contract: beyond it everyone else is "Người khác". */
export const SPEAKER_LIMIT = 8;
export const HINT_MAX = 60;
export const LAST_TEXT_MAX = 200;
/** A `new` speaker whose hint nearly matches the one issued this recently is the same person. */
export const MERGE_WINDOW_MS = 5_000;
/** Share of words two hints must have in common to count as the same voice. */
const MERGE_SIMILARITY = 0.5;

export interface KnownSpeaker {
  label: string;
  hint: string;
  lastText: string;
}

const wordsOf = (hint: string): Set<string> =>
  new Set(
    hint
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  );

/** Equal, or at least half of the words shared (Jaccard); an empty hint never matches. */
export function hintsNearlyEqual(a: string, b: string): boolean {
  const left = wordsOf(a);
  const right = wordsOf(b);
  if (left.size === 0 || right.size === 0) return false;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared) >= MERGE_SIMILARITY;
}

/**
 * The people heard so far in one meeting. Memory only: the hints describe voices, so nothing here is
 * stored, logged or kept after the meeting (`clear`).
 */
export function createSpeakerRegistry(now: () => number = Date.now) {
  let speakers: KnownSpeaker[] = [];
  let lastIssued: { label: string; hint: string; at: number } | null = null;

  return {
    /** A copy to send along; empty at the first sentence, which asks the model to start labelling. */
    known(): KnownSpeaker[] {
      return speakers.map((speaker) => ({ ...speaker }));
    },

    /** Takes the model's verdict on one sentence; returns its label, or null for "Người khác". */
    resolve(verdict: TranscribeResponse['speaker'], text: string): string | null {
      if (!verdict) return null;
      const lastText = text.slice(0, LAST_TEXT_MAX);
      const existing = speakers.find((speaker) => speaker.label === verdict.label);
      if (existing) {
        existing.lastText = lastText;
        return existing.label;
      }
      if (verdict.label !== 'new') return null;

      const hint = (verdict.hint ?? '').trim().slice(0, HINT_MAX);
      const at = now();
      if (
        lastIssued &&
        at - lastIssued.at <= MERGE_WINDOW_MS &&
        hintsNearlyEqual(hint, lastIssued.hint)
      ) {
        const same = speakers.find((speaker) => speaker.label === lastIssued!.label);
        if (same) {
          same.lastText = lastText;
          return same.label;
        }
      }
      if (speakers.length >= SPEAKER_LIMIT) return null;
      const label = `speaker_${speakers.length + 1}`;
      speakers.push({ label, hint, lastText });
      lastIssued = { label, hint, at };
      return label;
    },

    clear() {
      speakers = [];
      lastIssued = null;
    },
  };
}

export type SpeakerRegistry = ReturnType<typeof createSpeakerRegistry>;
