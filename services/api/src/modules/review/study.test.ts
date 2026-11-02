import { newFsrsState } from '@cuelingo/learner-model';
import { describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryStudyRepository, type StudyItem } from './study.repository';
import { createStudyService, streakDays, wantsDictation } from './study.service';

const NOW = new Date('2026-11-05T09:00:00Z');
const item = (n: number, patch: Partial<StudyItem> = {}): StudyItem => ({
  itemId: `00000000-0000-4000-8000-00000000000${n}`,
  phrase: ['circle back', 'push back', 'align with', 'touch base', 'roll out'][n]!,
  meaningVi: ['quay lại', 'dời lại', 'thống nhất', 'giữ liên lạc', 'triển khai'][n]!,
  contextEn: null,
  inReview: true,
  fsrs: null,
  ...patch,
});

function setup() {
  const repo = createInMemoryStudyRepository();
  const service = createStudyService(repo, () => NOW);
  return { repo, service };
}

describe('languages', () => {
  it('builds the queue and progress from one language only', async () => {
    const { repo, service } = setup();
    repo.seed('alice', item(0));
    repo.seed('alice', item(1), 'ja');
    repo.seed('alice', item(2), 'ja');

    expect((await service.queue('alice')).cards.map((card) => card.phrase)).toEqual([
      'circle back',
    ]);
    expect((await service.queue('alice', { language: 'ja' })).dueCount).toBe(2);
    expect((await service.progress('alice')).phrasesSaved).toBe(1);
    expect((await service.progress('alice', 'ja')).phrasesSaved).toBe(2);
  });

  it('counts a review towards the language of the answered phrase', async () => {
    const { repo, service } = setup();
    const japanese = item(1);
    repo.seed('alice', japanese, 'ja');
    await service.answer('alice', { itemId: japanese.itemId, exercise: 'recognize', rating: 3 });

    expect((await service.progress('alice', 'ja')).reviewsLast7Days.at(-1)?.count).toBe(1);
    expect((await service.progress('alice')).reviewsLast7Days.at(-1)?.count).toBe(0);
  });
});

describe('review queue', () => {
  it('contains new phrases and drops them after a good answer until they are due again', async () => {
    const { repo, service } = setup();
    for (let n = 0; n < 4; n++) repo.seed('alice', item(n));
    const first = await service.queue('alice');
    expect(first.dueCount).toBe(4);

    const answer = await service.answer('alice', {
      itemId: item(0).itemId,
      exercise: 'recognize',
      rating: 3,
    });
    expect(new Date(answer.nextDue).getTime()).toBeGreaterThan(NOW.getTime());
    const after = await service.queue('alice');
    expect(after.dueCount).toBe(3);
    expect(after.cards.map((c) => c.itemId)).not.toContain(item(0).itemId);
  });

  it('builds recognize cards with exactly one correct, distinct choice', async () => {
    const { repo, service } = setup();
    for (let n = 0; n < 4; n++) repo.seed('alice', item(n));
    const { cards } = await service.queue('alice');
    const recognize = cards.filter((card) => card.exercise === 'recognize');
    expect(recognize.length).toBeGreaterThan(0);
    for (const card of recognize) {
      expect(new Set(card.choices).size).toBe(card.choices.length);
      expect(card.choices.filter((choice) => choice === card.answer)).toHaveLength(1);
    }
  });

  it('builds a cloze card with a blank when the context sentence contains the phrase', async () => {
    const { repo, service } = setup();
    // Pick a phrase that is not read aloud, so this card is a cloze.
    const index = [0, 1, 2, 3, 4].find((n) => !wantsDictation(item(n)))!;
    const phrase = item(index).phrase;
    const clozeItem = item(index, {
      contextEn: `We must ${phrase} on the budget next week.`,
      meaningVi: null,
    });
    repo.seed('alice', clozeItem);
    repo.seed('alice', item((index + 1) % 5));
    const { cards } = await service.queue('alice');
    const card = cards.find((c) => c.itemId === clozeItem.itemId)!;
    expect(card.exercise).toBe('cloze');
    expect(card.prompt).toContain('____');
    expect(card.prompt).not.toContain(phrase);
    expect(card.answer).toBe(phrase);
  });

  it('skips phrases that are not due yet and phrases removed from review', async () => {
    const { repo, service } = setup();
    repo.seed(
      'alice',
      item(0, { fsrs: { ...newFsrsState(NOW), due: '2026-11-09T00:00:00.000Z' } }),
    );
    repo.seed('alice', item(1, { inReview: false }));
    expect((await service.queue('alice')).dueCount).toBe(0);
  });

  it("keeps users apart: Bob cannot answer Alice's phrase", async () => {
    const { repo, service } = setup();
    repo.seed('alice', item(0));
    await expect(
      service.answer('bob', { itemId: item(0).itemId, exercise: 'recognize', rating: 3 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('dictation cards', () => {
  const many = (count: number): StudyItem[] =>
    Array.from({ length: count }, (_, n) => ({
      itemId: `00000000-0000-4000-8000-${String(n + 100).padStart(12, '0')}`,
      phrase: `phrase number ${n}`,
      meaningVi: `nghĩa ${n}`,
      contextEn: null,
      inReview: true,
      fsrs: null,
    }));

  it('reads some phrases aloud and asks for them to be typed, with no choices', async () => {
    const { repo, service } = setup();
    for (const entry of many(30)) repo.seed('alice', entry);
    const { cards } = await service.queue('alice', { dictation: true });
    const without = await service.queue('alice');
    expect(without.cards.some((card) => card.exercise === 'dictation')).toBe(false);
    // The queue is capped, so look at the builder across all items too.
    const dictation = many(30).filter(wantsDictation);
    expect(dictation.length).toBeGreaterThan(3);
    expect(dictation.length).toBeLessThan(20);

    const card = cards.find((candidate) => candidate.exercise === 'dictation');
    if (card) {
      expect(card.choices).toEqual([]);
      expect(card.prompt).toBe(card.phrase);
      expect(card.answer).toBe(card.phrase);
    }
  });

  it('is stable: the same phrase is always the same kind of exercise', () => {
    const [entry] = many(1);
    expect(wantsDictation(entry!)).toBe(wantsDictation({ ...entry! }));
  });
});

describe('progress', () => {
  it('counts streak, the last 7 days and 4 weeks from the facts', async () => {
    const { repo, service } = setup();
    repo.seed('alice', item(0));
    repo.seed('alice', item(1, { inReview: false }));
    repo.seedFacts('alice', {
      reviewTimes: [
        new Date('2026-11-05T08:00:00Z'),
        new Date('2026-11-05T08:30:00Z'),
        new Date('2026-11-04T10:00:00Z'),
        new Date('2026-11-02T10:00:00Z'),
      ],
      meetingStarts: [new Date('2026-11-03T10:00:00Z'), new Date('2026-10-20T10:00:00Z')],
      lookupTimes: [new Date('2026-11-03T10:05:00Z'), new Date('2026-11-04T10:05:00Z')],
      avgComprehensionPct: 80,
    });
    const progress = await service.progress('alice');
    expect(progress).toMatchObject({
      phrasesSaved: 2,
      phrasesInReview: 1,
      dueToday: 1,
      streakDays: 2,
      meetingsCount: 2,
      avgComprehensionPct: 80,
    });
    expect(progress.reviewsLast7Days).toHaveLength(7);
    expect(progress.reviewsLast7Days.at(-1)).toEqual({ date: '2026-11-05', count: 2 });
    expect(progress.weekly.map((w) => w.weekStart)).toEqual([
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
      '2026-11-02',
    ]);
    expect(progress.weekly[3]).toEqual({ weekStart: '2026-11-02', meetings: 1, lookups: 2 });
    expect(progress.weekly[1]).toMatchObject({ meetings: 1, lookups: 0 });
  });

  it('streak counts from yesterday when today has no review yet, and breaks on a gap', () => {
    const days = new Set(['2026-11-04', '2026-11-03', '2026-11-01']);
    expect(streakDays(days, NOW)).toBe(2);
    expect(streakDays(new Set(), NOW)).toBe(0);
  });
});

describe('review routes', () => {
  it('rejects a bad answer body and requires a session', async () => {
    const app = await buildTestApp();
    const bad = await app.inject({
      method: 'POST',
      url: '/v1/review/answer',
      headers: { [TEST_USER_HEADER]: 'alice' },
      payload: { itemId: 'nope', exercise: 'recognize', rating: 9 },
    });
    expect(bad.statusCode).toBe(400);
    const anonymous = await app.inject({ method: 'GET', url: '/v1/review/queue' });
    expect(anonymous.statusCode).toBe(401);
    const empty = await app.inject({
      method: 'GET',
      url: '/v1/progress',
      headers: { [TEST_USER_HEADER]: 'alice' },
    });
    expect(empty.statusCode).toBe(200);
    expect(empty.json().streakDays).toBe(0);
    await app.close();
  });
});
