import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPostgresCoursesRepository } from '../../src/modules/courses';
import { createPostgresDebriefRepository } from '../../src/modules/debrief';
import { createPostgresPrivacyRepository } from '../../src/modules/privacy';
import {
  createPostgresPhrasesRepository,
  createPostgresStudyRepository,
} from '../../src/modules/review';
import { createPostgresSessionsRepository } from '../../src/modules/sessions';
import { buildTestApp, TEST_USER_HEADER } from '../../src/testing';
import { startMigratedPostgres, type TestDatabase } from './postgres';

describe('courses on real Postgres (AC1, AC4, AC7, AC8)', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let alice: string;
  let bob: string;
  let sessionId: string;

  const newUser = async (email: string) =>
    (
      await sql<
        { id: string }[]
      >`INSERT INTO auth_user (name, email) VALUES (${email}, ${email}) RETURNING id`
    )[0]!.id;
  const as = (userId: string) => ({ [TEST_USER_HEADER]: userId });
  const get = (userId: string, url: string) =>
    app.inject({ method: 'GET', url, headers: as(userId) });

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
    alice = await newUser('courses-alice@example.com');
    bob = await newUser('courses-bob@example.com');
    const [session] = await sql<{ id: string }[]>`
      INSERT INTO sessions (user_id, assist_level, status) VALUES (${alice}, 3, 'debriefed')
      RETURNING id`;
    sessionId = session!.id;
    const [segment] = await sql<{ id: string }[]>`
      INSERT INTO segments (session_id, source, start_ms, end_ms, text_en)
      VALUES (${sessionId}, 'system', 0, 1000, 'Let us touch base on Friday.') RETURNING id`;
    await sql`
      INSERT INTO debriefs (session_id, summary, hard_segment_ids, phrase_suggestions, prompt_version)
      VALUES (${sessionId}, ${sql.json({ headlineVi: 'Họp tuần', bulletsVi: [] })},
              ${[segment!.id]}::uuid[],
              ${sql.json([
                { phrase: 'circle back', meaningVi: 'quay lại sau' },
                { phrase: 'touch base', meaningVi: 'giữ liên lạc' },
                { phrase: 'loop in', meaningVi: 'kéo ai vào' },
              ])}, 'v1')`;
    app = await buildTestApp({
      repos: {
        sessions: createPostgresSessionsRepository(sql),
        debrief: createPostgresDebriefRepository(sql),
        courses: createPostgresCoursesRepository(sql),
        phrases: createPostgresPhrasesRepository(sql),
        study: createPostgresStudyRepository(sql),
        privacy: createPostgresPrivacyRepository(sql),
      },
    });
  });
  afterAll(async () => {
    await app?.close();
    await sql?.end();
    await db?.stop();
  });

  it('builds the course, starts it and finishes a lesson through the review route', async () => {
    const list = (await get(alice, '/v1/courses')).json();
    expect(list.courses).toMatchObject([{ sessionId, lessonCount: 3, unsavedCount: 3 }]);
    const course = (await get(alice, `/v1/courses/${sessionId}`)).json();
    // The phrase found in the hard segment comes first.
    expect(course.lessons[0]).toMatchObject({ phrase: 'touch base', origin: 'hard' });

    const start = await app.inject({
      method: 'POST',
      url: `/v1/courses/${sessionId}/start`,
      headers: as(alice),
    });
    expect(start.json()).toEqual({ added: 3 });
    const queue = (await get(alice, `/v1/courses/${sessionId}/queue`)).json();
    expect(queue.cards).toHaveLength(3);

    const answered = await app.inject({
      method: 'POST',
      url: '/v1/review/answer',
      headers: as(alice),
      payload: { itemId: queue.cards[0].itemId, exercise: 'recognize', rating: 3 },
    });
    expect(answered.statusCode).toBe(200);
    const after = (await get(alice, `/v1/courses/${sessionId}`)).json();
    expect(after).toMatchObject({ doneCount: 1, progressPct: 33, unsavedCount: 0 });
  });

  it('hides the course from another user', async () => {
    expect((await get(bob, '/v1/courses')).json().courses).toEqual([]);
    expect((await get(bob, `/v1/courses/${sessionId}`)).statusCode).toBe(404);
    const prep = await app.inject({
      method: 'POST',
      url: '/v1/courses/prep',
      headers: as(bob),
      payload: { sessionIds: [sessionId] },
    });
    expect(prep.json().lessons).toEqual([]);
  });

  it('drops the course when the meeting is deleted', async () => {
    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/sessions/${sessionId}`,
      headers: as(alice),
    });
    expect(del.statusCode).toBe(204);
    expect((await get(alice, '/v1/courses')).json().courses).toEqual([]);
    expect((await get(alice, `/v1/courses/${sessionId}`)).statusCode).toBe(404);
  });

  it('drops a live course when the personal data is deleted (AC8)', async () => {
    const [session] = await sql<{ id: string }[]>`
      INSERT INTO sessions (user_id, assist_level, status) VALUES (${alice}, 3, 'debriefed')
      RETURNING id`;
    await sql`
      INSERT INTO debriefs (session_id, summary, phrase_suggestions, prompt_version)
      VALUES (${session!.id}, ${sql.json({ headlineVi: 'Họp mới', bulletsVi: [] })},
              ${sql.json([
                { phrase: 'circle back', meaningVi: 'quay lại sau' },
                { phrase: 'touch base', meaningVi: 'giữ liên lạc' },
                { phrase: 'loop in', meaningVi: 'kéo ai vào' },
              ])}, 'v1')`;
    expect((await get(alice, '/v1/courses')).json().courses).toHaveLength(1);
    await createPostgresPrivacyRepository(sql).deleteMyData(alice);
    expect((await get(alice, '/v1/courses')).json().courses).toEqual([]);
  });
});
