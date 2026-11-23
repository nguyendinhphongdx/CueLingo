import { Writable } from 'node:stream';
import type { AiGateway } from '@cuelingo/ai-gateway';
import { lessonSample } from '@cuelingo/prompts';
import {
  GOAL_CATALOG,
  resolvePlanLimits,
  type GoalList,
  type LessonContent,
  type LessonView,
  type PlanLimitsOverride,
  type UsageResponse,
} from '@cuelingo/shared';
import { describe, expect, it, vi } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryGlossaryRepository } from '../glossary';
import { createInMemoryPhrasesRepository, createInMemoryStudyRepository } from '../review';
import { createInMemoryGoalsRepository } from './goals.repository.memory';
import type { GoalsDeps } from './goals.service';

const ALICE = 'alice';
const BOB = 'bob';
const CAROL = 'carol';
const DAVE = 'dave';
const as = (user: string) => ({ [TEST_USER_HEADER]: user });

const SECRET_SENTENCE = 'We signed the Zeta Corp contract yesterday';
const SECRET_BETTER = 'Zeta Corp was signed yesterday, confidential feedback';

type Json = AiGateway['json'];
type Call = { task: string; input: Record<string, unknown>; userId?: string };

const feedback = {
  verdict: 'minor',
  grammarVi: 'Dùng thì quá khứ.',
  better: SECRET_BETTER,
  register: 'neutral',
};
const personal = {
  examples: [
    {
      en: 'I finished the sprint review notes.',
      vi: 'Tôi đã xong ghi chú buổi tổng kết.',
      term: 'sprint review',
    },
  ],
};

/** A gateway that answers each task from a table, so a test changes only the task it is about. */
function fakeGateway(overrides: Partial<Record<string, () => unknown>> = {}) {
  const calls: Call[] = [];
  let generated = 0;
  const json = vi.fn(
    async (
      task: string,
      input: Record<string, unknown>,
      _schema: unknown,
      context?: { userId?: string },
    ) => {
      calls.push({ task, input, userId: context?.userId });
      const override = overrides[task];
      if (override) return override();
      if (task === 'lesson.generate') {
        generated += 1;
        const lesson: LessonContent = structuredClone(lessonSample);
        lesson.situation.descriptionVi = `Phiên bản ${generated} của tình huống.`;
        return lesson;
      }
      if (task === 'lesson.personalize') return personal;
      return feedback;
    },
  ) as unknown as ReturnType<typeof vi.fn> & Json;
  return {
    json,
    calls,
    count: (task: string) => calls.filter((call) => call.task === task).length,
  };
}

async function setup(
  options: {
    gateway?: ReturnType<typeof fakeGateway> | null;
    limits?: PlanLimitsOverride;
    goals?: Omit<GoalsDeps, 'gateway'>;
    logger?: Writable;
  } = {},
) {
  const goals = createInMemoryGoalsRepository();
  const study = createInMemoryStudyRepository();
  const phrases = createInMemoryPhrasesRepository();
  const glossary = createInMemoryGlossaryRepository();
  // Postgres keeps the Phrase Bank and the review state in one table; mirror that for the two memory stores.
  const baseSave = phrases.save;
  phrases.save = async (userId, input) => {
    const saved = await baseSave(userId, input);
    if (!(await study.listItems(userId)).some((item) => item.itemId === saved.id)) {
      study.seed(userId, {
        itemId: saved.id,
        phrase: saved.phrase,
        meaningVi: saved.meaningVi,
        contextEn: input.context ?? null,
        inReview: true,
        fsrs: null,
      });
    }
    return saved;
  };
  const gateway = options.gateway === undefined ? fakeGateway() : options.gateway;
  const app = await buildTestApp({
    repos: { goals, study, phrases, glossary },
    goals: { ...(gateway ? { gateway: { json: gateway.json } } : {}), ...options.goals },
    planLimits: resolvePlanLimits(options.limits),
    logger: options.logger ? { level: 'info', stream: options.logger } : undefined,
  });
  const call = (
    user: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: unknown,
  ) =>
    app.inject({
      method,
      url,
      headers: as(user),
      ...(payload === undefined ? {} : { payload: payload as object }),
    });
  const createGoal = async (
    user: string,
    goalKey = 'standup',
    extra: Record<string, unknown> = {},
  ) => (await call(user, 'POST', '/v1/goals', { goalKey, ...extra })).json();
  const open = (user: string, goalId: string, lessonKey = 'done') =>
    call(user, 'GET', `/v1/goals/${goalId}/lessons/${lessonKey}`);
  const usage = async (user: string) =>
    (await call(user, 'GET', '/v1/me/usage')).json<UsageResponse>().usage;
  return { app, goals, study, phrases, glossary, gateway, call, createGoal, open, usage };
}

/** Choice indexes of the sample quiz: the first `right` answers are right, the others are wrong. */
const answers = (right: number) =>
  lessonSample.quiz.questions.map((question, index) => {
    const correct = question.options.indexOf(question.answer);
    return {
      question: index,
      choice: index < right ? correct : (correct + 1) % question.options.length,
    };
  });

describe('goals (AC1, AC2)', () => {
  it('creates a goal with its six lessons at once and without any AI call', async () => {
    const { call, gateway } = await setup();
    const response = await call(ALICE, 'POST', '/v1/goals', {
      goalKey: 'standup',
      deadline: '2026-12-01',
    });
    expect(response.statusCode).toBe(201);
    const goal = response.json();
    expect(goal).toMatchObject({
      goalKey: 'standup',
      language: 'en',
      level: 'b1',
      deadline: '2026-12-01',
      lessonCount: 6,
      doneCount: 0,
      progressPct: 0,
    });
    expect(goal.lessons.map((lesson: { lessonKey: string }) => lesson.lessonKey)).toEqual(
      GOAL_CATALOG[0].lessons.map((lesson) => lesson.key),
    );
    expect(goal.lessons.every((lesson: { status: string }) => lesson.status === 'todo')).toBe(true);
    expect(gateway!.json).not.toHaveBeenCalled();
    const list = (await call(ALICE, 'GET', '/v1/goals')).json<GoalList>();
    expect(list.goals).toHaveLength(1);
    expect(list.nextUp).toMatchObject({
      goalId: goal.id,
      lessonKey: 'done',
      lessonTitleVi: 'Báo việc đã làm',
    });
  });

  it('changes the level and the deadline, clears the deadline and deletes the goal', async () => {
    const { call, createGoal } = await setup();
    const goal = await createGoal(ALICE, 'demo', { deadline: '2026-12-01' });
    const patched = await call(ALICE, 'PATCH', `/v1/goals/${goal.id}`, {
      level: 'c1',
      deadline: null,
    });
    expect(patched.json()).toMatchObject({ level: 'c1', deadline: null });
    expect((await call(ALICE, 'PATCH', `/v1/goals/${goal.id}`, {})).statusCode).toBe(400);
    expect((await call(ALICE, 'DELETE', `/v1/goals/${goal.id}`)).statusCode).toBe(204);
    expect((await call(ALICE, 'GET', '/v1/goals')).json<GoalList>().goals).toEqual([]);
    expect((await call(ALICE, 'DELETE', `/v1/goals/${goal.id}`)).statusCode).toBe(404);
  });

  it('refuses a fourth goal and a repeated goal with 409', async () => {
    const { call, createGoal } = await setup();
    for (const key of ['standup', 'demo', 'onsite']) await createGoal(ALICE, key);
    expect((await call(ALICE, 'POST', '/v1/goals', { goalKey: 'interview' })).statusCode).toBe(409);
    expect((await call(ALICE, 'POST', '/v1/goals', { goalKey: 'demo' })).statusCode).toBe(409);
  });

  it('rejects a goal outside the catalog and a user id in the body', async () => {
    const { call } = await setup();
    expect((await call(ALICE, 'POST', '/v1/goals', { goalKey: 'cooking' })).statusCode).toBe(400);
    expect(
      (await call(ALICE, 'POST', '/v1/goals', { goalKey: 'demo', userId: BOB })).statusCode,
    ).toBe(400);
  });

  it('starts at the listening level of the person, else B1, and an explicit level wins (AC5)', async () => {
    const { goals, createGoal } = await setup();
    goals.seedListeningLevel(ALICE, 'en', 'c1');
    expect((await createGoal(ALICE, 'demo')).level).toBe('c1');
    expect((await createGoal(BOB, 'demo')).level).toBe('b1');
    expect((await createGoal(ALICE, 'standup', { level: 'a2' })).level).toBe('a2');
  });

  it('works without an AI gateway except for making lessons', async () => {
    const { call, createGoal, open } = await setup({ gateway: null });
    const goal = await createGoal(ALICE);
    expect((await call(ALICE, 'GET', '/v1/goals')).statusCode).toBe(200);
    const response = await open(ALICE, goal.id);
    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('LESSON_FAILED');
  });
});

describe('opening a lesson (AC3, AC4, AC5, AC10)', () => {
  it('makes the four parts, once, and keeps the answers on the server', async () => {
    const { createGoal, open, gateway } = await setup();
    const goal = await createGoal(ALICE);
    const response = await open(ALICE, goal.id);
    expect(response.statusCode).toBe(200);
    const lesson = response.json<LessonView>();
    expect(lesson).toMatchObject({
      goalId: goal.id,
      lessonKey: 'done',
      titleVi: 'Báo việc đã làm',
      level: 'b1',
      promptVersion: 'lesson.generate@v1',
      status: 'learning',
      bestCorrect: null,
      attempts: 0,
    });
    expect(lesson.situation.keyPhrases.length).toBeGreaterThanOrEqual(5);
    expect(lesson.dialogue.turns.length).toBeGreaterThanOrEqual(6);
    expect(lesson.practice.prompts).toHaveLength(3);
    expect(lesson.quiz.questions).toHaveLength(6);
    for (const question of lesson.quiz.questions) {
      expect(Object.keys(question).sort()).toEqual(['kind', 'options', 'prompt']);
    }
    expect(JSON.stringify(lesson)).not.toContain('explanationVi');
    expect(gateway!.count('lesson.generate')).toBe(1);
  });

  it('opens an unknown lesson of a goal with 404', async () => {
    const { createGoal, open } = await setup();
    const goal = await createGoal(ALICE);
    expect((await open(ALICE, goal.id, 'nope')).statusCode).toBe(404);
  });

  it('feeds the shared lesson only catalog keys, the level and the language (AC5)', async () => {
    const { createGoal, open, gateway, glossary } = await setup();
    await glossary.create(ALICE, {
      term: 'sprint review',
      translation: null,
      note: null,
      language: 'en',
    });
    const goal = await createGoal(ALICE);
    await open(ALICE, goal.id);
    const generate = gateway!.calls.find((call) => call.task === 'lesson.generate')!;
    expect(generate.input).toEqual({
      goalKey: 'standup',
      lessonKey: 'done',
      level: 'b1',
      language: 'en',
    });
    expect(JSON.stringify(generate.input)).not.toContain('sprint review');
    const personalize = gateway!.calls.find((call) => call.task === 'lesson.personalize')!;
    expect(personalize.input.terms).toEqual([{ term: 'sprint review', translation: null }]);
  });

  it('adds examples with the own terms of the person, and none without terms', async () => {
    const { createGoal, open, gateway, glossary } = await setup();
    const none = await createGoal(ALICE);
    expect((await open(ALICE, none.id)).json<LessonView>().examples).toEqual([]);
    expect(gateway!.count('lesson.personalize')).toBe(0);
    await glossary.create(BOB, {
      term: 'sprint review',
      translation: null,
      note: null,
      language: 'en',
    });
    const goal = await createGoal(BOB);
    expect((await open(BOB, goal.id)).json<LessonView>().examples).toEqual(personal.examples);
  });

  it('still gives a complete lesson when the personal examples cannot be made', async () => {
    const { createGoal, open, glossary } = await setup({
      gateway: fakeGateway({
        'lesson.personalize': () => {
          throw new Error('down');
        },
      }),
    });
    await glossary.create(ALICE, {
      term: 'sprint review',
      translation: null,
      note: null,
      language: 'en',
    });
    const goal = await createGoal(ALICE);
    const response = await open(ALICE, goal.id);
    expect(response.statusCode).toBe(200);
    expect(response.json<LessonView>().examples).toEqual([]);
    expect(response.json<LessonView>().quiz.questions).toHaveLength(6);
  });

  it('never shows or stores a lesson that breaks the rules, and does not count it (AC4, AC9)', async () => {
    const broken = structuredClone(lessonSample);
    broken.quiz.questions[0]!.answer = 'not one of the options';
    const gateway = fakeGateway({ 'lesson.generate': () => broken });
    const { createGoal, open, goals, usage } = await setup({ gateway });
    const goal = await createGoal(ALICE);
    const response = await open(ALICE, goal.id);
    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('LESSON_FAILED');
    expect(gateway.count('lesson.generate')).toBe(2);
    expect(goals.contents()).toEqual([]);
    expect((await usage(ALICE)).lessons_daily.used).toBe(0);
  });

  it('counts one new lesson, and opening again asks no AI and counts nothing (AC10)', async () => {
    const { createGoal, open, gateway, usage } = await setup();
    const goal = await createGoal(ALICE);
    expect((await usage(ALICE)).lessons_daily).toMatchObject({ used: 0, limit: 2 });
    await open(ALICE, goal.id);
    const before = gateway!.calls.length;
    const again = await open(ALICE, goal.id);
    expect(again.statusCode).toBe(200);
    expect(gateway!.calls.length).toBe(before);
    expect((await usage(ALICE)).lessons_daily.used).toBe(1);
  });

  it('shares the lesson: the second person does not ask the model again, but still counts', async () => {
    const { createGoal, open, gateway, usage } = await setup();
    const a = await createGoal(ALICE);
    const b = await createGoal(BOB);
    await open(ALICE, a.id);
    const lesson = (await open(BOB, b.id)).json<LessonView>();
    expect(gateway!.count('lesson.generate')).toBe(1);
    expect(lesson.situation.descriptionVi).toBe('Phiên bản 1 của tình huống.');
    expect((await usage(BOB)).lessons_daily.used).toBe(1);
  });

  it('makes a cell once when two people open it at the same time', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const gateway = fakeGateway({
      'lesson.generate': () => gate.then(() => structuredClone(lessonSample)),
    });
    const { createGoal, open } = await setup({ gateway });
    const a = await createGoal(ALICE);
    const b = await createGoal(BOB);
    const both = Promise.all([open(ALICE, a.id), open(BOB, b.id)]);
    await vi.waitFor(() => expect(gateway.count('lesson.generate')).toBe(1));
    release();
    const [first, second] = await both;
    expect([first.statusCode, second.statusCode]).toEqual([200, 200]);
    expect(gateway.count('lesson.generate')).toBe(1);
  });

  it('keeps level apart: another level is another content', async () => {
    const { createGoal, open, gateway } = await setup();
    const a = await createGoal(ALICE, 'standup', { level: 'a2' });
    const b = await createGoal(BOB, 'standup', { level: 'b2' });
    await open(ALICE, a.id);
    await open(BOB, b.id);
    expect(gateway!.count('lesson.generate')).toBe(2);
  });
});

describe('when the AI fails or the allowance is used up (AC9)', () => {
  it('still opens lessons already opened, and the review queue, while new ones cannot be made', async () => {
    let down = false;
    const gateway = fakeGateway({
      'lesson.generate': () => {
        if (down) throw new Error('provider down');
        return structuredClone(lessonSample);
      },
    });
    const { createGoal, open, call, usage } = await setup({ gateway });
    const goal = await createGoal(ALICE);
    expect((await open(ALICE, goal.id, 'done')).statusCode).toBe(200);
    down = true;
    const failed = await open(ALICE, goal.id, 'plan');
    expect(failed.statusCode).toBe(502);
    expect(failed.json().error.code).toBe('LESSON_FAILED');
    expect(failed.body).not.toContain('provider down');
    expect((await usage(ALICE)).lessons_daily.used).toBe(1);
    expect((await open(ALICE, goal.id, 'done')).statusCode).toBe(200);
    expect((await call(ALICE, 'GET', '/v1/review/queue')).statusCode).toBe(200);
  });

  it('refuses a new lesson with 429 once the day is used up, and keeps opened ones open', async () => {
    const { createGoal, open } = await setup({ limits: { free: { lessons_daily: 1 } } });
    const goal = await createGoal(ALICE);
    expect((await open(ALICE, goal.id, 'done')).statusCode).toBe(200);
    const refused = await open(ALICE, goal.id, 'plan');
    expect(refused.statusCode).toBe(429);
    expect(refused.json().error).toMatchObject({
      code: 'QUOTA_EXCEEDED',
      details: { metric: 'lessons_daily', plan: 'free', used: 1, limit: 1 },
    });
    expect((await open(ALICE, goal.id, 'done')).statusCode).toBe(200);
  });
});

describe('practice (AC6)', () => {
  const sentence = { promptIndex: 0, sentence: SECRET_SENTENCE };

  it('returns feedback from the AI, counts one, and stores nothing', async () => {
    const { createGoal, open, call, gateway, usage, goals } = await setup();
    const goal = await createGoal(ALICE);
    await open(ALICE, goal.id);
    const response = await call(
      ALICE,
      'POST',
      `/v1/goals/${goal.id}/lessons/done/practice`,
      sentence,
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(feedback);
    const asked = gateway!.calls.find((c) => c.task === 'lesson.feedback')!;
    expect(asked.input).toMatchObject({
      goalKey: 'standup',
      level: 'b1',
      targetPhrase: lessonSample.practice.prompts[0]!.targetPhrase,
      sentence: SECRET_SENTENCE,
    });
    expect((await usage(ALICE)).lesson_practice_daily.used).toBe(1);
    expect(JSON.stringify(goals.contents())).not.toContain('Zeta');
    // Opening again shows no earlier sentence or feedback.
    expect((await open(ALICE, goal.id)).body).not.toContain('Zeta');
  });

  it('needs the lesson to be opened first and a known prompt', async () => {
    const { createGoal, open, call } = await setup();
    const goal = await createGoal(ALICE);
    const url = `/v1/goals/${goal.id}/lessons/done/practice`;
    expect((await call(ALICE, 'POST', url, sentence)).statusCode).toBe(404);
    await open(ALICE, goal.id);
    expect((await call(ALICE, 'POST', url, { promptIndex: 3, sentence: 'x' })).statusCode).toBe(
      400,
    );
    expect((await call(ALICE, 'POST', url, { promptIndex: 0, sentence: '  ' })).statusCode).toBe(
      400,
    );
  });

  it('answers 502 and counts nothing when the AI fails or answers badly', async () => {
    const { createGoal, open, call, usage } = await setup({
      gateway: fakeGateway({
        'lesson.feedback': () => ({ ...feedback, verdict: 'wrong', grammarVi: undefined }),
      }),
    });
    const goal = await createGoal(ALICE);
    await open(ALICE, goal.id);
    const response = await call(
      ALICE,
      'POST',
      `/v1/goals/${goal.id}/lessons/done/practice`,
      sentence,
    );
    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('LESSON_FAILED');
    expect((await usage(ALICE)).lesson_practice_daily.used).toBe(0);

    const down = await setup({
      gateway: fakeGateway({
        'lesson.feedback': () => {
          throw new Error(SECRET_SENTENCE);
        },
      }),
    });
    const other = await down.createGoal(ALICE);
    await down.open(ALICE, other.id);
    const failure = await down.call(
      ALICE,
      'POST',
      `/v1/goals/${other.id}/lessons/done/practice`,
      sentence,
    );
    expect(failure.statusCode).toBe(502);
    expect(failure.body).not.toContain('Zeta');
    expect((await down.usage(ALICE)).lesson_practice_daily.used).toBe(0);
  });

  it('stops at the daily allowance with 429', async () => {
    const { createGoal, open, call } = await setup({
      limits: { free: { lesson_practice_daily: 1 } },
    });
    const goal = await createGoal(ALICE);
    await open(ALICE, goal.id);
    const url = `/v1/goals/${goal.id}/lessons/done/practice`;
    expect((await call(ALICE, 'POST', url, sentence)).statusCode).toBe(200);
    const refused = await call(ALICE, 'POST', url, sentence);
    expect(refused.statusCode).toBe(429);
    expect(refused.json().error.details.metric).toBe('lesson_practice_daily');
  });

  it('limits how fast one person can ask', async () => {
    let now = 0;
    const { createGoal, open, call } = await setup({
      goals: { maxPracticePerWindow: 2, windowMs: 60_000, clock: () => now },
    });
    const goal = await createGoal(ALICE);
    await open(ALICE, goal.id);
    const url = `/v1/goals/${goal.id}/lessons/done/practice`;
    expect((await call(ALICE, 'POST', url, sentence)).statusCode).toBe(200);
    expect((await call(ALICE, 'POST', url, sentence)).statusCode).toBe(200);
    expect((await call(ALICE, 'POST', url, sentence)).statusCode).toBe(429);
    now += 60_000;
    expect((await call(ALICE, 'POST', url, sentence)).statusCode).toBe(200);
  });
});

describe('quiz (AC7)', () => {
  it('passes at 4 of 6, not at 3, marks the lesson done and keeps the best score', async () => {
    const { createGoal, open, call } = await setup();
    const goal = await createGoal(ALICE);
    await open(ALICE, goal.id);
    const submit = (right: number) =>
      call(ALICE, 'POST', `/v1/goals/${goal.id}/lessons/done/quiz`, { answers: answers(right) });

    const three = (await submit(3)).json();
    expect(three).toMatchObject({
      correct: 3,
      total: 6,
      passed: false,
      passMark: 4,
      bestCorrect: 3,
    });
    expect((await open(ALICE, goal.id)).json<LessonView>().status).toBe('learning');

    const four = (await submit(4)).json();
    expect(four).toMatchObject({ correct: 4, passed: true, bestCorrect: 4 });
    expect(four.results).toHaveLength(6);
    expect(four.results[0]).toMatchObject({ correct: true, explanationVi: expect.any(String) });
    const done = (await open(ALICE, goal.id)).json<LessonView>();
    expect(done).toMatchObject({ status: 'done', bestCorrect: 4, attempts: 2 });

    expect((await submit(6)).json().bestCorrect).toBe(6);
    expect((await submit(2)).json()).toMatchObject({ correct: 2, passed: false, bestCorrect: 6 });
    expect((await open(ALICE, goal.id)).json<LessonView>()).toMatchObject({
      status: 'done',
      bestCorrect: 6,
    });

    const list = (await call(ALICE, 'GET', '/v1/goals')).json<GoalList>();
    expect(list.goals[0]).toMatchObject({ doneCount: 1, progressPct: 17 });
    expect(list.nextUp?.lessonKey).toBe('plan');
  });

  it('saves the key phrases and writes one review per question through the ordinary path', async () => {
    const { createGoal, open, call, study } = await setup();
    const goal = await createGoal(ALICE);
    await open(ALICE, goal.id);
    const url = `/v1/goals/${goal.id}/lessons/done/quiz`;
    const first = (await call(ALICE, 'POST', url, { answers: answers(4) })).json();
    const distinct = new Set(lessonSample.quiz.questions.map((q) => q.phrase.toLowerCase()));
    expect(first.phrasesAdded).toBe(distinct.size);
    const items = await study.listItems(ALICE, 'en');
    expect(items).toHaveLength(distinct.size);
    expect(items.every((item) => item.fsrs !== null)).toBe(true);
    const facts = await study.progressFacts(ALICE, 'en', new Date(0));
    expect(facts.reviewTimes).toHaveLength(6);
    // Doing it again adds no phrase and writes six more reviews.
    const second = (await call(ALICE, 'POST', url, { answers: answers(6) })).json();
    expect(second.phrasesAdded).toBe(0);
    expect((await study.progressFacts(ALICE, 'en', new Date(0))).reviewTimes).toHaveLength(12);
  });

  it('counts a choice outside the options as wrong, and needs the lesson to be opened', async () => {
    const { createGoal, open, call } = await setup();
    const goal = await createGoal(ALICE);
    const url = `/v1/goals/${goal.id}/lessons/done/quiz`;
    expect((await call(ALICE, 'POST', url, { answers: answers(6) })).statusCode).toBe(404);
    await open(ALICE, goal.id);
    const wild = answers(6).map((a) => ({ ...a, choice: 3 }));
    const result = (await call(ALICE, 'POST', url, { answers: wild })).json();
    expect(result.results.filter((r: { correct: boolean }) => r.correct).length).toBeLessThan(6);
    expect((await call(ALICE, 'POST', url, { answers: answers(6).slice(1) })).statusCode).toBe(400);
  });

  it('does not use the daily allowance of lessons or practice', async () => {
    const { createGoal, open, call, usage } = await setup();
    const goal = await createGoal(ALICE);
    await open(ALICE, goal.id);
    await call(ALICE, 'POST', `/v1/goals/${goal.id}/lessons/done/quiz`, { answers: answers(5) });
    const used = await usage(ALICE);
    expect([used.lessons_daily.used, used.lesson_practice_daily.used]).toEqual([1, 0]);
  });
});

describe('reports and quality (AC4)', () => {
  it('takes a version out at the third different person; people who opened it keep it', async () => {
    const { createGoal, open, call, goals, gateway } = await setup();
    const people = [ALICE, BOB, CAROL];
    const ids = new Map<string, string>();
    for (const user of people) {
      const goal = await createGoal(user);
      ids.set(user, goal.id);
      await open(user, goal.id);
    }
    const report = (user: string, reason = 'english') =>
      call(user, 'POST', `/v1/goals/${ids.get(user)}/lessons/done/report`, { reason });
    expect((await report(ALICE)).statusCode).toBe(204);
    expect((await report(ALICE, 'level')).statusCode).toBe(204);
    expect((await report(BOB)).statusCode).toBe(204);
    expect(goals.contents()[0]!.status).toBe('live');
    expect((await report(CAROL, 'vietnamese')).statusCode).toBe(204);
    expect(goals.contents()[0]!.status).toBe('retired');
    expect(goals.reportsOf(goals.contents()[0]!.id)).toHaveLength(3);

    // People who opened it keep that version; a new person gets a new one.
    expect((await open(ALICE, ids.get(ALICE)!)).json<LessonView>().situation.descriptionVi).toBe(
      'Phiên bản 1 của tình huống.',
    );
    const dave = await createGoal(DAVE);
    const fresh = (await open(DAVE, dave.id)).json<LessonView>();
    expect(fresh.situation.descriptionVi).toBe('Phiên bản 2 của tình huống.');
    expect(gateway!.count('lesson.generate')).toBe(2);
    expect(goals.contents().map((row) => [row.revision, row.status])).toEqual([
      [1, 'retired'],
      [2, 'live'],
    ]);
  });

  it('needs the lesson to be opened and a known reason', async () => {
    const { createGoal, call } = await setup();
    const goal = await createGoal(ALICE);
    const url = `/v1/goals/${goal.id}/lessons/done/report`;
    expect((await call(ALICE, 'POST', url, { reason: 'english' })).statusCode).toBe(404);
    expect((await call(ALICE, 'POST', url, { reason: 'rude' })).statusCode).toBe(400);
  });
});

describe('user boundary (AC11)', () => {
  it('gives another person 404 for every goal and lesson route, and changes nothing', async () => {
    const { createGoal, open, call, goals } = await setup();
    const goal = await createGoal(ALICE);
    await open(ALICE, goal.id);
    const base = `/v1/goals/${goal.id}`;
    const attempts = [
      call(BOB, 'PATCH', base, { level: 'c1' }),
      call(BOB, 'DELETE', base),
      call(BOB, 'GET', `${base}/lessons/done`),
      call(BOB, 'GET', `${base}/lessons/plan`),
      call(BOB, 'POST', `${base}/lessons/done/practice`, { promptIndex: 0, sentence: 'Hello' }),
      call(BOB, 'POST', `${base}/lessons/done/quiz`, { answers: answers(6) }),
      call(BOB, 'POST', `${base}/lessons/done/report`, { reason: 'english' }),
    ];
    for (const response of await Promise.all(attempts)) {
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('NOT_FOUND');
    }
    expect((await call(BOB, 'GET', '/v1/goals')).json<GoalList>()).toEqual({
      goals: [],
      nextUp: null,
    });
    const mine = (await call(ALICE, 'GET', '/v1/goals')).json<GoalList>();
    expect(mine.goals[0]).toMatchObject({ level: 'b1', doneCount: 0 });
    expect(mine.goals[0]!.lessons[0]).toMatchObject({ status: 'learning', bestCorrect: null });
    expect(goals.contents()).toHaveLength(1);
  });

  it('keeps two people with the same goal apart', async () => {
    const { createGoal, open, call } = await setup();
    const a = await createGoal(ALICE);
    const b = await createGoal(BOB);
    await open(ALICE, a.id);
    await call(ALICE, 'POST', `/v1/goals/${a.id}/lessons/done/quiz`, { answers: answers(6) });
    const bob = (await call(BOB, 'GET', '/v1/goals')).json<GoalList>();
    expect(bob.goals[0]).toMatchObject({ id: b.id, doneCount: 0, progressPct: 0 });
    expect(bob.goals[0]!.lessons[0]!.status).toBe('todo');
  });

  it('needs a signed-in person', async () => {
    const { app } = await setup();
    expect((await app.inject({ method: 'GET', url: '/v1/goals' })).statusCode).toBe(401);
  });
});

describe('logs (AC12)', () => {
  it('never write what the person typed, a question, a lesson line or the feedback', async () => {
    let logs = '';
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logs += chunk.toString();
        callback();
      },
    });
    const { createGoal, open, call } = await setup({ logger: stream });
    const goal = await createGoal(ALICE);
    await open(ALICE, goal.id);
    await call(ALICE, 'POST', `/v1/goals/${goal.id}/lessons/done/practice`, {
      promptIndex: 0,
      sentence: SECRET_SENTENCE,
    });
    await call(ALICE, 'POST', `/v1/goals/${goal.id}/lessons/done/quiz`, { answers: answers(5) });
    expect(logs).toContain('goal practice');
    expect(logs).toContain('goal quiz');
    for (const secret of [
      'Zeta',
      'confidential feedback',
      lessonSample.quiz.questions[0]!.prompt,
      lessonSample.quiz.questions[0]!.explanationVi,
      lessonSample.dialogue.turns[0]!.en,
      lessonSample.situation.descriptionVi,
    ]) {
      expect(logs).not.toContain(secret);
    }
  });
});

describe('cost limits and the switch of new lessons', () => {
  const never = () => new Promise<never>(() => undefined);
  const timeoutError = () =>
    Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' });

  it('does not ask the model again at once for a cell that just failed, then tries again later', async () => {
    let now = 1_000_000;
    const gateway = fakeGateway({
      'lesson.generate': () => {
        throw new Error('provider down');
      },
    });
    const { createGoal, open, usage } = await setup({
      gateway,
      goals: { clock: () => now, failureCooldownMs: 60_000, maxOpensPerWindow: 50 },
    });
    const goal = await createGoal(ALICE);
    expect((await open(ALICE, goal.id)).statusCode).toBe(502);
    expect(gateway.count('lesson.generate')).toBe(2);
    const again = await open(ALICE, goal.id);
    expect(again.statusCode).toBe(502);
    expect(again.json().error.message).toMatch(/đợi/);
    expect(gateway.count('lesson.generate')).toBe(2);
    // Another person asking for the same cell is held back by the same short memory.
    const bob = await createGoal(BOB);
    expect((await open(BOB, bob.id)).statusCode).toBe(502);
    expect(gateway.count('lesson.generate')).toBe(2);
    expect((await usage(ALICE)).lessons_daily.used).toBe(0);
    now += 61_000;
    await open(ALICE, goal.id);
    expect(gateway.count('lesson.generate')).toBe(4);
  });

  it('limits first opens per minute for one person, without counting them or touching opened lessons', async () => {
    let now = 1_000_000;
    const { createGoal, open, usage, gateway } = await setup({
      goals: { clock: () => now, maxOpensPerWindow: 2 },
      limits: { free: { lessons_daily: 10 } },
    });
    const goal = await createGoal(ALICE);
    expect((await open(ALICE, goal.id, 'done')).statusCode).toBe(200);
    expect((await open(ALICE, goal.id, 'plan')).statusCode).toBe(200);
    const third = await open(ALICE, goal.id, 'blocker');
    expect(third.statusCode).toBe(429);
    expect(third.json().error.code).toBe('RATE_LIMITED');
    expect(gateway!.count('lesson.generate')).toBe(2);
    expect((await open(ALICE, goal.id, 'done')).statusCode).toBe(200);
    expect((await usage(ALICE)).lessons_daily.used).toBe(2);
    now += 61_000;
    expect((await open(ALICE, goal.id, 'blocker')).statusCode).toBe(200);
  });

  it('does not use a cell that is already made for the minute limit', async () => {
    const { createGoal, open } = await setup({ goals: { maxOpensPerWindow: 1 } });
    const a = await createGoal(ALICE);
    const b = await createGoal(BOB);
    expect((await open(ALICE, a.id)).statusCode).toBe(200);
    // Bob needs no model call: the content exists.
    expect((await open(BOB, b.id)).statusCode).toBe(200);
  });

  it('counts a lesson once when two tabs open it at the same time', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const gateway = fakeGateway({
      'lesson.generate': () => gate.then(() => structuredClone(lessonSample)),
    });
    const { createGoal, open, usage } = await setup({ gateway });
    const goal = await createGoal(ALICE);
    const both = Promise.all([open(ALICE, goal.id), open(ALICE, goal.id)]);
    await vi.waitFor(() => expect(gateway.count('lesson.generate')).toBe(1));
    release();
    const [first, second] = await both;
    expect([first.statusCode, second.statusCode]).toEqual([200, 200]);
    expect((await usage(ALICE)).lessons_daily.used).toBe(1);
  });

  it('gives up on a new lesson that takes too long, counts nothing and does not wait for the end', async () => {
    const gateway = fakeGateway({ 'lesson.generate': never });
    const { createGoal, open, usage } = await setup({ gateway, goals: { lessonDeadlineMs: 20 } });
    const goal = await createGoal(ALICE);
    const response = await open(ALICE, goal.id);
    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('LESSON_FAILED');
    expect((await usage(ALICE)).lessons_daily.used).toBe(0);
  });

  it('does not try again after a timeout', async () => {
    const gateway = fakeGateway({
      'lesson.generate': () => {
        throw timeoutError();
      },
    });
    const { createGoal, open } = await setup({ gateway });
    const goal = await createGoal(ALICE);
    expect((await open(ALICE, goal.id)).statusCode).toBe(502);
    expect(gateway.count('lesson.generate')).toBe(1);
  });

  it('does not try feedback again after a timeout, and stops waiting after the deadline', async () => {
    const timedOut = fakeGateway({
      'lesson.feedback': () => {
        throw timeoutError();
      },
    });
    const first = await setup({ gateway: timedOut });
    const goal = await first.createGoal(ALICE);
    await first.open(ALICE, goal.id);
    const url = `/v1/goals/${goal.id}/lessons/done/practice`;
    const body = { promptIndex: 0, sentence: SECRET_SENTENCE };
    expect((await first.call(ALICE, 'POST', url, body)).statusCode).toBe(502);
    expect(timedOut.count('lesson.feedback')).toBe(1);

    const slow = fakeGateway({ 'lesson.feedback': never });
    const second = await setup({ gateway: slow, goals: { feedbackDeadlineMs: 20 } });
    const other = await second.createGoal(ALICE);
    await second.open(ALICE, other.id);
    const response = await second.call(
      ALICE,
      'POST',
      `/v1/goals/${other.id}/lessons/done/practice`,
      body,
    );
    expect(response.statusCode).toBe(502);
    expect((await second.usage(ALICE)).lesson_practice_daily.used).toBe(0);
  });

  it('with the switch off: goals and opened lessons work, new lessons and practice say not open yet', async () => {
    const { createGoal, open, call, goals, usage, gateway } = await setup({
      goals: { enabled: false },
    });
    const goal = await createGoal(ALICE);
    expect((await call(ALICE, 'GET', '/v1/goals')).statusCode).toBe(200);
    const refused = await open(ALICE, goal.id);
    expect(refused.statusCode).toBe(503);
    expect(refused.json().error).toMatchObject({
      code: 'LESSONS_DISABLED',
      message: expect.stringContaining('chưa mở'),
    });
    expect(gateway!.calls).toHaveLength(0);
    expect((await usage(ALICE)).lessons_daily.used).toBe(0);

    // A lesson opened while the switch was on stays readable and its quiz can be taken.
    const content = await goals.insertContent({
      goalKey: 'standup',
      lessonKey: 'done',
      level: 'b1',
      language: 'en',
      promptVersion: 'lesson.generate@v1',
      model: 'test',
      content: structuredClone(lessonSample),
    });
    await goals.pinLesson(ALICE, goal.id, 'done', content!.id);
    expect((await open(ALICE, goal.id)).statusCode).toBe(200);
    const practice = await call(ALICE, 'POST', `/v1/goals/${goal.id}/lessons/done/practice`, {
      promptIndex: 0,
      sentence: SECRET_SENTENCE,
    });
    expect(practice.statusCode).toBe(503);
    expect(practice.json().error.code).toBe('LESSONS_DISABLED');
    expect(
      (await call(ALICE, 'POST', `/v1/goals/${goal.id}/lessons/done/quiz`, { answers: answers(5) }))
        .statusCode,
    ).toBe(200);
  });

  it('keeps the typed sentence out of the response and the logs when the AI fails with it in the error (AC12)', async () => {
    let logs = '';
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logs += chunk.toString();
        callback();
      },
    });
    const gateway = fakeGateway({
      'lesson.feedback': () => {
        throw new Error(`provider rejected: ${SECRET_SENTENCE}`);
      },
    });
    const { createGoal, open, call } = await setup({ gateway, logger: stream });
    const goal = await createGoal(ALICE);
    await open(ALICE, goal.id);
    const response = await call(ALICE, 'POST', `/v1/goals/${goal.id}/lessons/done/practice`, {
      promptIndex: 0,
      sentence: SECRET_SENTENCE,
    });
    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain('Zeta');
    expect(logs).not.toContain('Zeta');
  });
});
