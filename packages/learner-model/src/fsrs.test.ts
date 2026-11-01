import { describe, expect, it } from 'vitest';
import { isDue, newFsrsState, reviewCard, type ReviewRating } from './fsrs';

const t0 = new Date('2026-11-01T09:00:00Z');
const days = (from: string, to: Date) => (new Date(from).getTime() - to.getTime()) / 86_400_000;

describe('FSRS wrapper', () => {
  it('a new card is due immediately', () => {
    expect(isDue(newFsrsState(t0), t0)).toBe(true);
  });

  it('is pure: the same review gives the same result and leaves the input alone', () => {
    const card = newFsrsState(t0);
    const copy = structuredClone(card);
    expect(reviewCard(card, 3, t0)).toEqual(reviewCard(card, 3, t0));
    expect(card).toEqual(copy);
  });

  it('a successful review pushes the due date out and counts the repetition', () => {
    const next = reviewCard(newFsrsState(t0), 3, t0);
    expect(next.reps).toBe(1);
    expect(next.lastReview).toBe(t0.toISOString());
    expect(new Date(next.due).getTime()).toBeGreaterThan(t0.getTime());
  });

  it('easier answers wait longer than harder ones', () => {
    const due = (rating: ReviewRating) => reviewCard(newFsrsState(t0), rating, t0).due;
    expect(new Date(due(4)).getTime()).toBeGreaterThan(new Date(due(3)).getTime());
    expect(new Date(due(3)).getTime()).toBeGreaterThanOrEqual(new Date(due(1)).getTime());
  });

  it('intervals grow across good reviews and lapses are counted on a failure', () => {
    let card = reviewCard(newFsrsState(t0), 3, t0);
    let when = new Date(card.due);
    const first = days(card.due, t0);
    for (let i = 0; i < 4; i++) {
      card = reviewCard(card, 3, when);
      when = new Date(card.due);
    }
    expect(days(card.due, t0)).toBeGreaterThan(first);
    const lapsed = reviewCard(card, 1, when);
    expect(lapsed.lapses).toBeGreaterThanOrEqual(1);
  });

  it('round-trips through JSON (jsonb storage)', () => {
    const card = reviewCard(newFsrsState(t0), 3, t0);
    expect(JSON.parse(JSON.stringify(card))).toEqual(card);
  });
});
