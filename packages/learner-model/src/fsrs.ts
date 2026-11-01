import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs';

/** FSRS card as stored in `user_lexicon.*_fsrs` (jsonb): plain JSON, dates as ISO strings. */
export interface FsrsState {
  due: string;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: 0 | 1 | 2 | 3;
  lastReview: string | null;
}

/** 1 again · 2 hard · 3 good · 4 easy — same numbers as `review_logs.rating`. */
export type ReviewRating = 1 | 2 | 3 | 4;

const scheduler = fsrs();

const toCard = (state: FsrsState): Card => ({
  due: new Date(state.due),
  stability: state.stability,
  difficulty: state.difficulty,
  scheduled_days: state.scheduledDays,
  learning_steps: state.learningSteps,
  reps: state.reps,
  lapses: state.lapses,
  state: state.state,
  last_review: state.lastReview ? new Date(state.lastReview) : undefined,
});

const fromCard = (card: Card): FsrsState => ({
  due: card.due.toISOString(),
  stability: card.stability,
  difficulty: card.difficulty,
  scheduledDays: card.scheduled_days,
  learningSteps: card.learning_steps,
  reps: card.reps,
  lapses: card.lapses,
  state: card.state as FsrsState['state'],
  lastReview: card.last_review ? card.last_review.toISOString() : null,
});

/** A card that is due right now (first review). */
export function newFsrsState(now: Date = new Date()): FsrsState {
  return fromCard(createEmptyCard(now));
}

/** Pure: the state after one review. The same inputs always give the same output. */
export function reviewCard(
  state: FsrsState,
  rating: ReviewRating,
  now: Date = new Date(),
): FsrsState {
  const grade = rating as unknown as Grade;
  return fromCard(scheduler.next(toCard(state), now, grade).card);
}

export const isDue = (state: FsrsState, now: Date = new Date()): boolean =>
  new Date(state.due).getTime() <= now.getTime();

export { Rating };
