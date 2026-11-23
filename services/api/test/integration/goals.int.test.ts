import { lessonSample } from '@cuelingo/prompts';
import type { LessonView } from '@cuelingo/shared';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPostgresGlossaryRepository } from '../../src/modules/glossary';
import { createPostgresGoalsRepository } from '../../src/modules/goals';
import { createPostgresPrivacyRepository } from '../../src/modules/privacy';
import {
  createPostgresPhrasesRepository,
  createPostgresStudyRepository,
} from '../../src/modules/review';
import { createPostgresUsageRepository } from '../../src/modules/usage';
import { buildTestApp, TEST_USER_HEADER } from '../../src/testing';
import { startMigratedPostgres, type TestDatabase } from './postgres';

describe('goal lessons on real Postgres (AC2, AC7, AC10, AC11, AC12)', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let alice: string;
  let bob: string;
  let generated = 0;

  const newUser = async (email: string) =>
    (
      await sql<
        { id: string }[]
      >`INSERT INTO auth_user (name, email) VALUES (${email}, ${email}) RETURNING id`
    )[0]!.id;
  const as = (userId: string) => ({ [TEST_USER_HEADER]: userId });
  const call = (userId: string, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) =>
    app.inject({ method, url, headers: as(userId), ...(payload ? { payload } : {}) });
  const count = async (table: string, where = 'true') =>
    (
      await sql.unsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`)
    )[0]!.n;
  const answers = (right: number) =>
    lessonSample.quiz.questions.map((question, index) => {
      const correct = question.options.indexOf(question.answer);
      return {
        question: index,
        choice: index < right ? correct : (correct + 1) % question.options.length,
      };
    });
  const goalOf = async (userId: string, goalKey = 'standup') =>
    (await call(userId, 'POST', '/v1/goals', { goalKey })).json<{ id: string }>().id;

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
    alice = await newUser('goals-alice@example.com');
    bob = await newUser('goals-bob@example.com');
    const json = vi.fn(async (task: string) => {
      if (task === 'lesson.generate') {
        generated += 1;
        // A pause so that two first opens overlap.
        await new Promise((resolve) => setTimeout(resolve, 30));
        return structuredClone(lessonSample);
      }
      if (task === 'lesson.personalize') return { examples: [] };
      return { verdict: 'ok', better: 'I finished it.', register: 'neutral' };
    });
    app = await buildTestApp({
      repos: {
        goals: createPostgresGoalsRepository(sql),
        glossary: createPostgresGlossaryRepository(sql),
        phrases: createPostgresPhrasesRepository(sql),
        study: createPostgresStudyRepository(sql),
        usage: createPostgresUsageRepository(sql),
        privacy: createPostgresPrivacyRepository(sql),
      },
      goals: { gateway: { json: json as never } },
    });
  });
  afterAll(async () => {
    await app?.close();
    await sql?.end();
    await db?.stop();
  });

  it('stores a goal, shares one lesson content, pins it and counts the open', async () => {
    const aliceGoal = await goalOf(alice);
    const first = await call(alice, 'GET', `/v1/goals/${aliceGoal}/lessons/done`);
    expect(first.statusCode).toBe(200);
    expect(generated).toBe(1);
    expect(await count('lesson_contents')).toBe(1);
    const [content] = await sql<{ prompt_version: string; model: string; status: string }[]>`
      SELECT prompt_version, model, status FROM lesson_contents`;
    expect(content).toMatchObject({ prompt_version: 'lesson.generate@v1', status: 'live' });

    // The second person opens the same cell: no new content, a pin of their own, one more count.
    const bobGoal = await goalOf(bob);
    const second = await call(bob, 'GET', `/v1/goals/${bobGoal}/lessons/done`);
    expect(second.statusCode).toBe(200);
    expect(generated).toBe(1);
    expect(await count('lesson_contents')).toBe(1);
    expect(await count('goal_lessons', 'content_id IS NOT NULL')).toBe(2);
    const counted = await sql<{ user_id: string; amount: string }[]>`
      SELECT user_id, amount FROM usage_counters WHERE metric = 'lessons_daily'`;
    expect(counted.map((row) => [row.user_id, Number(row.amount)]).sort()).toEqual(
      [
        [alice, 1],
        [bob, 1],
      ].sort(),
    );

    // Opening again is free and asks no model.
    await call(alice, 'GET', `/v1/goals/${aliceGoal}/lessons/done`);
    expect(generated).toBe(1);
    expect(
      Number((await sql`SELECT amount FROM usage_counters WHERE user_id = ${alice}`)[0]!.amount),
    ).toBe(1);
  });

  it('keeps people apart: 404 for another person, and nothing of one in the list of the other', async () => {
    const id = (
      await sql<{ id: string }[]>`SELECT id FROM learning_goals WHERE user_id = ${alice}`
    )[0]!.id;
    for (const response of [
      await call(bob, 'GET', `/v1/goals/${id}/lessons/done`),
      await call(bob, 'PATCH', `/v1/goals/${id}`, { level: 'c1' }),
      await call(bob, 'POST', `/v1/goals/${id}/lessons/done/report`, { reason: 'english' }),
    ]) {
      expect(response.statusCode).toBe(404);
    }
    expect((await sql`SELECT level FROM learning_goals WHERE id = ${id}`)[0]!.level).toBe('b1');
    const list = (await call(bob, 'GET', '/v1/goals')).json<{ goals: Array<{ id: string }> }>();
    expect(list.goals.map((goal) => goal.id)).not.toContain(id);
  });

  it('grades the quiz, saves the phrases and writes one review log per question', async () => {
    const id = (
      await sql<{ id: string }[]>`SELECT id FROM learning_goals WHERE user_id = ${alice}`
    )[0]!.id;
    const result = await call(alice, 'POST', `/v1/goals/${id}/lessons/done/quiz`, {
      answers: answers(5),
    });
    expect(result.json()).toMatchObject({ correct: 5, passed: true, bestCorrect: 5 });
    expect(await count('review_logs', `user_id = '${alice}'`)).toBe(6);
    expect(await count('user_lexicon', `user_id = '${alice}'`)).toBeGreaterThan(0);
    const [row] = await sql<{ best_correct: number; attempts: number; done_at: Date | null }[]>`
      SELECT best_correct, attempts, done_at FROM goal_lessons WHERE user_id = ${alice}`;
    expect(row).toMatchObject({ best_correct: 5, attempts: 1 });
    expect(row!.done_at).not.toBeNull();
    const again = await call(alice, 'POST', `/v1/goals/${id}/lessons/done/quiz`, {
      answers: answers(1),
    });
    expect(again.json()).toMatchObject({ correct: 1, bestCorrect: 5 });
    expect(
      (await sql`SELECT attempts FROM goal_lessons WHERE user_id = ${alice}`)[0]!.attempts,
    ).toBe(2);
  });

  it('makes one live content when two people open a new cell at the same time', async () => {
    const carol = await newUser('goals-carol@example.com');
    const dave = await newUser('goals-dave@example.com');
    const before = generated;
    const [carolGoal, daveGoal] = [await goalOf(carol, 'demo'), await goalOf(dave, 'demo')];
    const [a, b] = await Promise.all([
      call(carol, 'GET', `/v1/goals/${carolGoal}/lessons/intro`),
      call(dave, 'GET', `/v1/goals/${daveGoal}/lessons/intro`),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    expect(generated - before).toBe(1);
    expect(await count('lesson_contents', `goal_key = 'demo' AND status = 'live'`)).toBe(1);
  });

  it('answers 409 to the same goal twice at once, and to a fourth goal', async () => {
    const erin = await newUser('goals-erin@example.com');
    const responses = await Promise.all([
      call(erin, 'POST', '/v1/goals', { goalKey: 'onsite' }),
      call(erin, 'POST', '/v1/goals', { goalKey: 'onsite' }),
    ]);
    expect(responses.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(await count('learning_goals', `user_id = '${erin}'`)).toBe(1);
    await goalOf(erin, 'demo');
    await goalOf(erin, 'interview');
    const fourth = await call(erin, 'POST', '/v1/goals', { goalKey: 'small-talk' });
    expect(fourth.statusCode).toBe(409);
    expect(await count('learning_goals', `user_id = '${erin}'`)).toBe(3);
  });

  it('keeps one live content when several inserts of the same cell run at once (ON CONFLICT)', async () => {
    const repo = createPostgresGoalsRepository(sql);
    const input = {
      goalKey: 'requirements',
      lessonKey: 'repeat',
      level: 'b1' as const,
      language: 'en' as const,
      promptVersion: 'lesson.generate@v1',
      model: 'test',
      content: structuredClone(lessonSample),
    };
    const stored = await Promise.all(Array.from({ length: 8 }, () => repo.insertContent(input)));
    expect(stored.every((row) => row !== null)).toBe(true);
    expect(new Set(stored.map((row) => row!.id)).size).toBe(1);
    expect(await count('lesson_contents', `goal_key = 'requirements' AND status = 'live'`)).toBe(1);
    expect(await count('lesson_contents', `goal_key = 'requirements'`)).toBe(1);
  });

  it('counts a lesson once when one person opens it in two tabs at the same time', async () => {
    const frank = await newUser('goals-frank@example.com');
    const id = await goalOf(frank, 'interview');
    const [a, b] = await Promise.all([
      call(frank, 'GET', `/v1/goals/${id}/lessons/intro`),
      call(frank, 'GET', `/v1/goals/${id}/lessons/intro`),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    const rows = await sql<{ amount: string }[]>`
      SELECT amount FROM usage_counters WHERE user_id = ${frank} AND metric = 'lessons_daily'`;
    expect(rows.map((row) => Number(row.amount))).toEqual([1]);
    expect(await count('goal_lessons', `user_id = '${frank}'`)).toBe(1);
  });

  it('takes a content version out after three reports and makes a new one for the next person', async () => {
    const reporters = [
      await newUser('goals-r1@example.com'),
      await newUser('goals-r2@example.com'),
      await newUser('goals-r3@example.com'),
    ];
    const ids: string[] = [];
    for (const user of reporters) {
      const id = await goalOf(user, 'negotiation');
      ids.push(id);
      await call(user, 'GET', `/v1/goals/${id}/lessons/decline`);
    }
    for (const [index, user] of reporters.entries()) {
      const report = await call(user, 'POST', `/v1/goals/${ids[index]}/lessons/decline/report`, {
        reason: 'off_goal',
      });
      expect(report.statusCode).toBe(204);
    }
    const rows = await sql<{ revision: number; status: string }[]>`
      SELECT revision, status FROM lesson_contents WHERE goal_key = 'negotiation'`;
    expect(rows).toEqual([{ revision: 1, status: 'retired' }]);
    const next = await newUser('goals-r4@example.com');
    const nextId = await goalOf(next, 'negotiation');
    const response = await call(next, 'GET', `/v1/goals/${nextId}/lessons/decline`);
    expect(response.json<LessonView>().promptVersion).toBe('lesson.generate@v1');
    expect(
      await sql`SELECT revision, status FROM lesson_contents WHERE goal_key = 'negotiation' ORDER BY revision`,
    ).toMatchObject([
      { revision: 1, status: 'retired' },
      { revision: 2, status: 'live' },
    ]);
  });

  it('deletes the goals, progress and reports of one person and leaves the shared content (AC12)', async () => {
    const reporter = await newUser('goals-del@example.com');
    const id = await goalOf(reporter, 'small-talk');
    await call(reporter, 'GET', `/v1/goals/${id}/lessons/greet`);
    await call(reporter, 'POST', `/v1/goals/${id}/lessons/greet/report`, { reason: 'level' });
    expect(await count('lesson_reports', `user_id = '${reporter}'`)).toBe(1);
    const contents = await count('lesson_contents');
    const counters = await count('usage_counters', `user_id = '${reporter}'`);

    await createPostgresPrivacyRepository(sql).deleteMyData(reporter);

    for (const table of ['learning_goals', 'goal_lessons', 'lesson_reports']) {
      expect(await count(table, `user_id = '${reporter}'`)).toBe(0);
    }
    expect(await count('lesson_contents')).toBe(contents);
    // Billing counters survive a data delete (ADR 0022).
    expect(await count('usage_counters', `user_id = '${reporter}'`)).toBe(counters);
    // Another person is untouched.
    expect(await count('learning_goals', `user_id = '${alice}'`)).toBe(1);
    expect(await count('goal_lessons', `user_id = '${bob}'`)).toBe(1);
  });
});
