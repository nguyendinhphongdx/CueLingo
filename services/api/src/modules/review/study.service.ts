import { isDue, newFsrsState, reviewCard, type ReviewRating } from '@cuelingo/learner-model';
import {
  DEFAULT_LANGUAGE,
  ErrorCode,
  type LanguageCode,
  type Progress,
  type ReviewAnswerRequest,
  type ReviewAnswerResponse,
  type ReviewCard,
  type ReviewQueue,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { StudyItem, StudyRepository } from './study.repository';

export type StudyService = ReturnType<typeof createStudyService>;

export const QUEUE_SIZE = 10;
const DAY_MS = 86_400_000;

/** Phrases to show as wrong answers when the user has too few of their own. */
const FALLBACK_PHRASES = ['follow up', 'touch base', 'take ownership', 'on the same page'];
const FALLBACK_MEANINGS = [
  'theo dõi tiếp',
  'giữ liên lạc',
  'nhận trách nhiệm',
  'cùng hiểu như nhau',
];

/** Deterministic hash so the same item always gets the same exercise and choice order. */
const hash = (text: string): number => {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
};

const shuffle = <T>(values: T[], seed: string): T[] =>
  values
    .map((value) => ({ value, key: hash(`${seed}:${String(value)}`) }))
    .sort((a, b) => a.key - b.key)
    .map(({ value }) => value);

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function pickDistractors(
  all: string[],
  correct: string,
  fallback: string[],
  seed: string,
): string[] {
  const pool = [...new Set([...shuffle(all, seed), ...fallback])].filter(
    (value) => value !== correct,
  );
  return pool.slice(0, 3);
}

/** Builds one exercise for an item; cloze needs a context sentence that really contains the phrase. */
/** Every third phrase is practised by ear: it is read aloud and the person types it. */
export const wantsDictation = (item: StudyItem) => hash(`dictation:${item.itemId}`) % 3 === 0;

/** `dictation: true` only for clients that know how to play and grade it (they ask with `?dictation=1`). */
export function buildCard(
  item: StudyItem,
  all: StudyItem[],
  options: { dictation?: boolean } = {},
): ReviewCard | null {
  if (options.dictation && wantsDictation(item) && item.phrase.length <= 60) {
    return {
      itemId: item.itemId,
      exercise: 'dictation',
      phrase: item.phrase,
      prompt: item.phrase,
      choices: [],
      answer: item.phrase,
      meaningVi: item.meaningVi,
      contextEn: item.contextEn,
    };
  }

  const sentence = item.contextEn?.replace(new RegExp(escapeRegExp(item.phrase), 'i'), '____');
  const clozeReady = Boolean(item.contextEn && sentence && sentence !== item.contextEn);
  const recognizeReady = item.meaningVi !== null;
  if (!clozeReady && !recognizeReady) return null;

  const preferCloze = clozeReady && (!recognizeReady || hash(item.itemId) % 2 === 0);
  const others = all.filter((other) => other.itemId !== item.itemId);
  if (preferCloze && sentence) {
    const wrong = pickDistractors(
      others.map((o) => o.phrase),
      item.phrase,
      FALLBACK_PHRASES,
      item.itemId,
    );
    return {
      itemId: item.itemId,
      exercise: 'cloze',
      phrase: item.phrase,
      prompt: sentence,
      choices: shuffle([item.phrase, ...wrong], item.itemId),
      answer: item.phrase,
      meaningVi: item.meaningVi,
      contextEn: item.contextEn,
    };
  }
  const meaning = item.meaningVi ?? '';
  const wrong = pickDistractors(
    others.flatMap((o) => (o.meaningVi ? [o.meaningVi] : [])),
    meaning,
    FALLBACK_MEANINGS,
    item.itemId,
  );
  return {
    itemId: item.itemId,
    exercise: 'recognize',
    phrase: item.phrase,
    prompt: item.phrase,
    choices: shuffle([meaning, ...wrong], item.itemId),
    answer: meaning,
    meaningVi: item.meaningVi,
    contextEn: item.contextEn,
  };
}

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

/** Monday (UTC) of the week containing `date`, as YYYY-MM-DD. */
const weekStart = (date: Date) => {
  const midnight = new Date(`${dayKey(date)}T00:00:00Z`);
  const offset = (midnight.getUTCDay() + 6) % 7;
  return dayKey(new Date(midnight.getTime() - offset * DAY_MS));
};

/** Consecutive days with a review, counted back from today (or yesterday if today has none yet). */
export function streakDays(reviewDays: Set<string>, now: Date): number {
  let cursor = new Date(`${dayKey(now)}T00:00:00Z`);
  if (!reviewDays.has(dayKey(cursor))) cursor = new Date(cursor.getTime() - DAY_MS);
  let streak = 0;
  while (reviewDays.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

export function createStudyService(repo: StudyRepository, clock: () => Date = () => new Date()) {
  return {
    async queue(
      userId: string,
      options: { dictation?: boolean; language?: LanguageCode } = {},
    ): Promise<ReviewQueue> {
      const now = clock();
      const items = await repo.listItems(userId, options.language ?? DEFAULT_LANGUAGE);
      const due = items
        .filter((item) => item.inReview && (item.fsrs === null || isDue(item.fsrs, now)))
        .sort((a, b) => (a.fsrs?.due ?? '').localeCompare(b.fsrs?.due ?? ''));
      const cards: ReviewCard[] = [];
      for (const item of due) {
        if (cards.length === QUEUE_SIZE) break;
        const card = buildCard(item, items, options);
        if (card) cards.push(card);
      }
      return { dueCount: due.length, cards };
    },

    async answer(userId: string, input: ReviewAnswerRequest): Promise<ReviewAnswerResponse> {
      const now = clock();
      // The answered item names its own language, so look across all of them.
      const items = await repo.listItems(userId);
      const item = items.find((candidate) => candidate.itemId === input.itemId);
      if (!item) throw new AppError(ErrorCode.NotFound, 'Phrase not found');
      const next = reviewCard(item.fsrs ?? newFsrsState(now), input.rating as ReviewRating, now);
      await repo.saveAnswer(userId, input.itemId, next, {
        exercise: input.exercise,
        rating: input.rating,
        responseMs: input.responseMs,
        at: now,
      });
      return { nextDue: next.due };
    },

    async progress(userId: string, language: LanguageCode = DEFAULT_LANGUAGE): Promise<Progress> {
      const now = clock();
      const today = new Date(`${dayKey(now)}T00:00:00Z`);
      const since = new Date(today.getTime() - 27 * DAY_MS);
      const [items, facts] = await Promise.all([
        repo.listItems(userId, language),
        repo.progressFacts(userId, language, since),
      ]);
      const reviewDays = new Map<string, number>();
      for (const time of facts.reviewTimes) {
        reviewDays.set(dayKey(time), (reviewDays.get(dayKey(time)) ?? 0) + 1);
      }
      const reviewsLast7Days = Array.from({ length: 7 }, (_, index) => {
        const date = dayKey(new Date(today.getTime() - (6 - index) * DAY_MS));
        return { date, count: reviewDays.get(date) ?? 0 };
      });
      const thisWeek = new Date(`${weekStart(now)}T00:00:00Z`);
      const weekly = Array.from({ length: 4 }, (_, index) => {
        const start = weekStart(new Date(thisWeek.getTime() - (3 - index) * 7 * DAY_MS));
        const inWeek = (time: Date) => weekStart(time) === start;
        return {
          weekStart: start,
          meetings: facts.meetingStarts.filter(inWeek).length,
          lookups: facts.lookupTimes.filter(inWeek).length,
        };
      });
      return {
        phrasesSaved: items.length,
        phrasesInReview: items.filter((item) => item.inReview).length,
        dueToday: items.filter(
          (item) => item.inReview && (item.fsrs === null || isDue(item.fsrs, now)),
        ).length,
        streakDays: streakDays(new Set(reviewDays.keys()), now),
        meetingsCount: facts.meetingStarts.length,
        avgComprehensionPct: facts.avgComprehensionPct,
        reviewsLast7Days,
        weekly,
      };
    },
  };
}
