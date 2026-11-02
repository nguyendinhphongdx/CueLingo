import type { AssistLevel } from './assist-dial';

/** Listening levels a placement test can report, from least to most comfortable. */
export type ListeningLevel = 'a2' | 'b1' | 'b2' | 'c1';

export interface PlacementOutcome {
  correct: number;
  total: number;
  listeningLevel: ListeningLevel;
  /** The help to start with. Never lower than 1: hiding everything is something the Assist Dial may suggest later. */
  assistDefault: AssistLevel;
}

/**
 * Turns the answers (right or wrong, one per passage) into a level and a starting assist level.
 * Pure: the passages and their answers live with the API.
 */
export function scorePlacement(results: readonly boolean[]): PlacementOutcome {
  const total = results.length;
  const correct = results.filter(Boolean).length;
  // Share of passages understood, so a test of another length keeps the same bands.
  const share = total === 0 ? 0 : correct / total;
  if (share >= 0.8) return { correct, total, listeningLevel: 'c1', assistDefault: 1 };
  if (share >= 0.6) return { correct, total, listeningLevel: 'b2', assistDefault: 1 };
  if (share >= 0.3) return { correct, total, listeningLevel: 'b1', assistDefault: 3 };
  return { correct, total, listeningLevel: 'a2', assistDefault: 4 };
}
