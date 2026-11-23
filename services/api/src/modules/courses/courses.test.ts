import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import type { Course, CourseList, Debrief, ReviewQueue } from '@cuelingo/shared';
import { describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryDebriefRepository } from '../debrief';
import { createInMemoryGlossaryRepository } from '../glossary';
import { createInMemoryStudyRepository, type StudyItem } from '../review';
import { createInMemorySessionsRepository } from '../sessions';
import { createInMemoryCoursesRepository } from './courses.repository.memory';

const ALICE = 'alice';
const BOB = 'bob';
const as = (user: string) => ({ [TEST_USER_HEADER]: user });
const SECRET_HEADLINE = 'Hop voi khach hang Zeta Corp';

const PHRASES = [
  ['circle back', 'quay lại sau'],
  ['touch base', 'giữ liên lạc'],
  ['on the same page', 'cùng hiểu như nhau'],
  ['take ownership', 'nhận trách nhiệm'],
  ['loop in', 'kéo ai vào'],
  ['moving forward', 'từ nay về sau'],
  ['heads up', 'báo trước'],
  ['bandwidth', 'khả năng đảm nhận'],
] as const;

const debriefFor = (
  sessionId: string,
  overrides: Partial<Debrief> = {},
  phrases: ReadonlyArray<readonly [string, string]> = PHRASES.slice(0, 4),
): Debrief => ({
  id: randomUUID(),
  sessionId,
  version: 1,
  createdAt: '2026-11-21T00:00:00.000Z',
  summary: { headlineVi: SECRET_HEADLINE, bulletsVi: [] },
  actionItems: [],
  hardSegmentIds: [],
  phraseSuggestions: phrases.map(([phrase, meaningVi]) => ({ phrase, meaningVi })),
  rephrase: [],
  comprehensionPct: null,
  ...overrides,
});

const studyItem = (phrase: string, meaningVi: string): StudyItem => ({
  itemId: randomUUID(),
  phrase,
  meaningVi,
  contextEn: null,
  inReview: true,
  fsrs: null,
});

async function setup(options: { logger?: Writable } = {}) {
  const sessions = createInMemorySessionsRepository();
  const debrief = createInMemoryDebriefRepository();
  const study = createInMemoryStudyRepository();
  const glossary = createInMemoryGlossaryRepository();
  const courses = createInMemoryCoursesRepository({ sessions, debrief, glossary });
  // The Postgres answer writes the review log in the same transaction; mirror that for the memory store.
  const saveAnswer = study.saveAnswer;
  study.saveAnswer = async (userId, itemId, fsrs, log) => {
    const saved = await saveAnswer(userId, itemId, fsrs, log);
    if (saved) courses.seedLog(userId, { itemId, at: log.at, rating: log.rating });
    return saved;
  };
  const app = await buildTestApp({
    repos: { sessions, debrief, study, glossary, courses },
    logger: options.logger ? { level: 'info', stream: options.logger } : undefined,
  });
  const meeting = async (
    user: string,
    debriefOverrides: Partial<Debrief> = {},
    phrases?: ReadonlyArray<readonly [string, string]>,
  ) => {
    const session = await sessions.create(user, { assistLevel: 0 });
    debrief.seed(user, debriefFor(session.id, debriefOverrides, phrases));
    return session;
  };
  const saved = (user: string, count: number) =>
    PHRASES.slice(0, count).map(([phrase, meaning]) => {
      const item = studyItem(phrase, meaning);
      study.seed(user, item);
      return item;
    });
  const get = async <T>(user: string, url: string): Promise<T> =>
    (await app.inject({ method: 'GET', url, headers: as(user) })).json() as T;
  return { app, sessions, debrief, study, courses, glossary, meeting, saved, get };
}

describe('courses module', () => {
  it('builds a course from the debrief of a meeting (AC1)', async () => {
    const { app, meeting, get } = await setup();
    const session = await meeting(ALICE);
    const list = await get<CourseList>(ALICE, '/v1/courses');
    expect(list.courses).toHaveLength(1);
    expect(list.courses[0]).toMatchObject({
      sessionId: session.id,
      lessonCount: 4,
      doneCount: 0,
      progressPct: 0,
      unsavedCount: 4,
    });
    const course = await get<Course>(ALICE, `/v1/courses/${session.id}`);
    expect(course.lessons.map((lesson) => lesson.phrase)).toEqual(
      PHRASES.slice(0, 4).map(([phrase]) => phrase),
    );
    await app.close();
  });

  it('puts phrases from a hard segment first, then the rest, then better sentences (AC1)', async () => {
    const { app, sessions, debrief, get } = await setup();
    const session = await sessions.create(ALICE, { assistLevel: 0 });
    const segmentId = randomUUID();
    await sessions.saveSegment({
      sessionId: session.id,
      userId: ALICE,
      segmentId,
      source: 'system',
      startMs: 0,
      endMs: 1000,
      textEn: 'Let us take ownership of it.',
    });
    debrief.seed(
      ALICE,
      debriefFor(session.id, {
        hardSegmentIds: [segmentId],
        rephrase: [{ said: 'say again', better: 'Could you repeat that?', noteVi: 'lịch sự hơn' }],
      }),
    );
    const course = await get<Course>(ALICE, `/v1/courses/${session.id}`);
    expect(course.lessons.map((lesson) => [lesson.phrase, lesson.origin])).toEqual([
      ['take ownership', 'hard'],
      ['circle back', 'phrase'],
      ['touch base', 'phrase'],
      ['on the same page', 'phrase'],
      ['could you repeat that?', 'rephrase'],
    ]);
    await app.close();
  });

  it('has no course under three lessons, and a newer debrief replaces the lessons (AC1)', async () => {
    const { app, debrief, meeting, get } = await setup();
    const short = await meeting(ALICE, {}, PHRASES.slice(0, 2));
    expect((await get<CourseList>(ALICE, '/v1/courses')).courses).toEqual([]);
    expect(
      (await app.inject({ method: 'GET', url: `/v1/courses/${short.id}`, headers: as(ALICE) }))
        .statusCode,
    ).toBe(404);
    debrief.seed(ALICE, debriefFor(short.id, { version: 2 }, PHRASES.slice(4, 8)));
    const course = await get<Course>(ALICE, `/v1/courses/${short.id}`);
    expect(course.lessons.map((lesson) => lesson.phrase)).toEqual(
      PHRASES.slice(4, 8).map(([phrase]) => phrase),
    );
    await app.close();
  });

  it('limits the list to the 20 newest meetings', async () => {
    const { app, meeting, get } = await setup();
    for (let n = 0; n < 22; n++) await meeting(ALICE);
    expect((await get<CourseList>(ALICE, '/v1/courses')).courses).toHaveLength(20);
    await app.close();
  });

  it('starts a course by saving its phrases to the Phrase Bank, once (AC1)', async () => {
    const { app, meeting } = await setup();
    const session = await meeting(ALICE);
    const start = () =>
      app.inject({ method: 'POST', url: `/v1/courses/${session.id}/start`, headers: as(ALICE) });
    expect((await start()).json()).toEqual({ added: 4 });
    await start();
    const phrases = await app.inject({ method: 'GET', url: '/v1/phrases', headers: as(ALICE) });
    expect(phrases.json().phrases).toHaveLength(4);
    expect(phrases.json().phrases[0].meaningVi).not.toBeNull();
    await app.close();
  });

  it('answers through the review route: FSRS changes and the lesson becomes done (AC3, AC4)', async () => {
    const { app, study, meeting, saved, get } = await setup();
    const session = await meeting(ALICE);
    const [first, second] = saved(ALICE, 4);
    const before = await get<Course>(ALICE, `/v1/courses/${session.id}`);
    expect(before.lessons.map((lesson) => lesson.status)).toEqual(['todo', 'todo', 'todo', 'todo']);

    const answer = (itemId: string, rating: number) =>
      app.inject({
        method: 'POST',
        url: '/v1/review/answer',
        headers: as(ALICE),
        payload: { itemId, exercise: 'recognize', rating },
      });
    expect((await answer(first!.itemId, 3)).statusCode).toBe(200);
    expect((await answer(second!.itemId, 2)).statusCode).toBe(200);

    const items = await study.listItems(ALICE);
    expect(items.find((item) => item.itemId === first!.itemId)!.fsrs).not.toBeNull();
    const after = await get<Course>(ALICE, `/v1/courses/${session.id}`);
    expect(after.lessons.map((lesson) => lesson.status)).toEqual([
      'done',
      'learning',
      'todo',
      'todo',
    ]);
    expect(after).toMatchObject({ doneCount: 1, progressPct: 25, unsavedCount: 0 });
    // The "again" that follows does not undo a finished lesson.
    await answer(first!.itemId, 1);
    expect((await get<Course>(ALICE, `/v1/courses/${session.id}`)).doneCount).toBe(1);

    // There is no scorer of the course's own.
    const own = await app.inject({
      method: 'POST',
      url: `/v1/courses/${session.id}/answer`,
      headers: as(ALICE),
      payload: { itemId: first!.itemId, rating: 4 },
    });
    expect(own.statusCode).toBe(404);
    await app.close();
  });

  it('ignores review logs from before the debrief (AC3)', async () => {
    const { app, courses, meeting, saved, get } = await setup();
    const session = await meeting(ALICE);
    const [first] = saved(ALICE, 4);
    courses.seedLog(ALICE, {
      itemId: first!.itemId,
      at: new Date('2026-11-20T23:59:59.000Z'),
      rating: 4,
    });
    const course = await get<Course>(ALICE, `/v1/courses/${session.id}`);
    expect(course.lessons[0]!.status).toBe('todo');
    await app.close();
  });

  it('queues at most five saved lessons not done, as review cards (AC5)', async () => {
    const { app, meeting, saved, get } = await setup();
    const session = await meeting(ALICE, {}, PHRASES);
    saved(ALICE, 7);
    const queue = await get<ReviewQueue>(ALICE, `/v1/courses/${session.id}/queue`);
    expect(queue.cards).toHaveLength(5);
    expect(queue.dueCount).toBe(8);
    expect(queue.cards.every((card) => ['recognize', 'cloze'].includes(card.exercise))).toBe(true);
    expect(queue.cards.map((card) => card.phrase)).toEqual(
      PHRASES.slice(0, 5).map(([phrase]) => phrase),
    );
    await app.close();
  });

  it('shows the next up lesson of the course in progress with a total (AC6)', async () => {
    const { app, meeting, saved, get } = await setup();
    const older = await meeting(ALICE);
    saved(ALICE, 4);
    await meeting(ALICE, {}, PHRASES.slice(4, 8));
    await app.inject({
      method: 'POST',
      url: '/v1/review/answer',
      headers: as(ALICE),
      payload: {
        itemId: (await get<Course>(ALICE, `/v1/courses/${older.id}`)).lessons[0]!.itemId,
        exercise: 'recognize',
        rating: 3,
      },
    });
    const list = await get<CourseList>(ALICE, '/v1/courses');
    expect(list.nextUp).toMatchObject({ sessionId: older.id, phrase: 'touch base', saved: true });
    await app.close();
  });

  describe('user boundary (AC7)', () => {
    it('keeps courses of one user from another: 404 on read, start and queue', async () => {
      const { app, meeting, saved, get } = await setup();
      const session = await meeting(ALICE);
      saved(ALICE, 4);
      expect((await get<CourseList>(BOB, '/v1/courses')).courses).toEqual([]);
      const read = (method: 'GET' | 'POST', url: string) =>
        app.inject({ method, url, headers: as(BOB) });
      expect((await read('GET', `/v1/courses/${session.id}`)).statusCode).toBe(404);
      expect((await read('POST', `/v1/courses/${session.id}/start`)).statusCode).toBe(404);
      expect((await read('GET', `/v1/courses/${session.id}/queue`)).statusCode).toBe(404);
      const phrases = await app.inject({ method: 'GET', url: '/v1/phrases', headers: as(BOB) });
      expect(phrases.json().phrases).toEqual([]);
      await app.close();
    });

    it('needs a signed-in user', async () => {
      const { app } = await setup();
      expect((await app.inject({ method: 'GET', url: '/v1/courses' })).statusCode).toBe(401);
      await app.close();
    });

    it('uses only the meetings of the user in preparation and writes nothing (AC2)', async () => {
      const { app, glossary, meeting, saved } = await setup();
      const mine = await meeting(ALICE);
      const theirs = await meeting(BOB);
      saved(ALICE, 4);
      saved(BOB, 4);
      await glossary.create(ALICE, {
        term: 'Zeta',
        translation: null,
        note: null,
        language: 'en',
      });
      const prep = (sessionIds: string[]) =>
        app.inject({
          method: 'POST',
          url: '/v1/courses/prep',
          headers: as(ALICE),
          payload: { sessionIds },
        });
      const own = (await prep([mine.id])).json();
      expect(own.lessons).toHaveLength(4);
      expect(own.terms).toEqual([{ term: 'Zeta', translation: null }]);
      const foreign = (await prep([theirs.id])).json();
      expect(foreign.lessons).toEqual([]);
      const phrases = await app.inject({ method: 'GET', url: '/v1/phrases', headers: as(ALICE) });
      expect(phrases.json().phrases).toEqual([]);
      expect((await prep([])).statusCode).toBe(400);
      await app.close();
    });
  });

  it('removes the course with the meeting (AC8)', async () => {
    const { app, meeting, get } = await setup();
    const session = await meeting(ALICE);
    expect((await get<CourseList>(ALICE, '/v1/courses')).courses).toHaveLength(1);
    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/sessions/${session.id}`,
      headers: as(ALICE),
    });
    expect(del.statusCode).toBe(204);
    expect((await get<CourseList>(ALICE, '/v1/courses')).courses).toEqual([]);
    expect(
      (await app.inject({ method: 'GET', url: `/v1/courses/${session.id}`, headers: as(ALICE) }))
        .statusCode,
    ).toBe(404);
    await app.close();
  });

  it('never writes phrases, sentences or titles to the logs (AC10)', async () => {
    let logs = '';
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logs += chunk.toString();
        callback();
      },
    });
    const { app, meeting, saved } = await setup({ logger: stream });
    const session = await meeting(ALICE);
    saved(ALICE, 4);
    await app.inject({ method: 'GET', url: '/v1/courses', headers: as(ALICE) });
    await app.inject({
      method: 'POST',
      url: `/v1/courses/${session.id}/start`,
      headers: as(ALICE),
    });
    await app.inject({ method: 'GET', url: `/v1/courses/${session.id}/queue`, headers: as(ALICE) });
    await app.inject({
      method: 'POST',
      url: '/v1/courses/prep',
      headers: as(ALICE),
      payload: { sessionIds: [session.id] },
    });
    expect(logs).toContain('course started');
    expect(logs).toContain(session.id);
    for (const [phrase, meaning] of PHRASES) {
      expect(logs).not.toContain(phrase);
      expect(logs).not.toContain(meaning);
    }
    expect(logs).not.toContain(SECRET_HEADLINE);
    await app.close();
  });
});
