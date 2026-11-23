import { describe, expect, it, vi } from 'vitest';
import { ApiError, createClient } from './index';

const GOAL = '3f2b9a52-6a4e-4d1e-9a52-1f7a7a3b9c10';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const clientWith = (response: Response) => {
  const fetch = vi.fn().mockResolvedValue(response);
  return { fetch, client: createClient({ baseUrl: 'http://api', getToken: () => 't0k', fetch }) };
};

const goal = {
  id: GOAL,
  goalKey: 'standup',
  titleVi: 'Họp stand-up hằng ngày',
  language: 'en',
  level: 'b1',
  deadline: null,
  createdAt: '2026-11-22T00:00:00.000Z',
  lessonCount: 6,
  doneCount: 0,
  progressPct: 0,
  lessons: ['done', 'plan', 'blocker', 'help', 'late', 'clarify'].map((lessonKey) => ({
    lessonKey,
    titleVi: lessonKey,
    status: 'todo',
    bestCorrect: null,
  })),
};

const keyPhrases = Array.from({ length: 5 }, (_, n) => ({
  en: `phrase ${n}`,
  meaningVi: `nghĩa ${n}`,
  register: 'neutral',
}));
const view = {
  goalId: GOAL,
  lessonKey: 'done',
  titleVi: 'Báo việc đã làm',
  level: 'b1',
  promptVersion: 'lesson.generate@v1',
  situation: { descriptionVi: 'Tình huống', keyPhrases },
  dialogue: {
    roles: { a: 'Lead', b: 'Dev' },
    turns: Array.from({ length: 6 }, (_, n) => ({
      speaker: n % 2 ? 'b' : 'a',
      en: `Line ${n}`,
      vi: `Dòng ${n}`,
    })),
  },
  practice: {
    prompts: Array.from({ length: 3 }, (_, n) => ({
      taskVi: `Việc ${n}`,
      targetPhrase: `phrase ${n}`,
    })),
  },
  quiz: {
    questions: Array.from({ length: 6 }, (_, n) => ({
      kind: 'choice',
      prompt: `Câu ${n}`,
      options: ['a', 'b', 'c'],
    })),
  },
  examples: [],
  status: 'learning',
  bestCorrect: null,
  attempts: 0,
};

describe('goals client', () => {
  it('lists goals with the token', async () => {
    const { client, fetch } = clientWith(json({ goals: [goal], nextUp: null }));
    expect((await client.goals.list()).goals).toHaveLength(1);
    expect(fetch.mock.calls[0]?.[0]).toBe('http://api/v1/goals');
    expect(fetch.mock.calls[0]?.[1].headers.authorization).toBe('Bearer t0k');
  });

  it('creates, updates and removes a goal without sending a user id', async () => {
    const created = clientWith(json(goal, 201));
    await created.client.goals.create({ goalKey: 'standup', deadline: '2026-12-01' });
    expect(created.fetch.mock.calls[0]?.[1].method).toBe('POST');
    expect(created.fetch.mock.calls[0]?.[1].body).toBe(
      JSON.stringify({ goalKey: 'standup', deadline: '2026-12-01' }),
    );
    const updated = clientWith(json(goal));
    await updated.client.goals.update(GOAL, { level: 'b2' });
    expect(updated.fetch.mock.calls[0]?.[0]).toBe(`http://api/v1/goals/${GOAL}`);
    expect(updated.fetch.mock.calls[0]?.[1].method).toBe('PATCH');
    const removed = clientWith(new Response(null, { status: 204 }));
    await expect(removed.client.goals.remove(GOAL)).resolves.toBeUndefined();
    expect(removed.fetch.mock.calls[0]?.[1].method).toBe('DELETE');
  });

  it('opens a lesson and checks the answer against the contract', async () => {
    const { client, fetch } = clientWith(json(view));
    const lesson = await client.goals.openLesson(GOAL, 'done');
    expect(lesson.quiz.questions).toHaveLength(6);
    expect(fetch.mock.calls[0]?.[0]).toBe(`http://api/v1/goals/${GOAL}/lessons/done`);
    const broken = clientWith(json({ ...view, quiz: { questions: [] } }));
    await expect(broken.client.goals.openLesson(GOAL, 'done')).rejects.toBeDefined();
  });

  it('sends practice, quiz and report to their own routes', async () => {
    const practice = clientWith(
      json({ verdict: 'ok', better: 'I finished.', register: 'neutral' }),
    );
    await practice.client.goals.practice(GOAL, 'done', { promptIndex: 0, sentence: 'I finished.' });
    expect(practice.fetch.mock.calls[0]?.[0]).toBe(
      `http://api/v1/goals/${GOAL}/lessons/done/practice`,
    );

    const quiz = clientWith(
      json({
        correct: 4,
        total: 6,
        passed: true,
        passMark: 4,
        bestCorrect: 4,
        results: Array.from({ length: 6 }, (_, question) => ({
          question,
          correct: true,
          answerIndex: 0,
          explanationVi: 'Vì sao',
        })),
        phrasesAdded: 5,
      }),
    );
    const result = await quiz.client.goals.submitQuiz(GOAL, 'done', {
      answers: Array.from({ length: 6 }, (_, question) => ({ question, choice: 0 })),
    });
    expect(result.passed).toBe(true);

    const report = clientWith(new Response(null, { status: 204 }));
    await report.client.goals.report(GOAL, 'done', { reason: 'english' });
    expect(report.fetch.mock.calls[0]?.[0]).toBe(`http://api/v1/goals/${GOAL}/lessons/done/report`);
  });

  it('throws an ApiError with the code and details of a refusal', async () => {
    const details = { metric: 'lessons_daily', plan: 'free', used: 2, limit: 2, resetsAt: 'x' };
    const { client } = clientWith(
      json({ error: { code: 'QUOTA_EXCEEDED', message: 'Usage allowance used up', details } }, 429),
    );
    const error = await client.goals.openLesson(GOAL, 'plan').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429, code: 'QUOTA_EXCEEDED', details });
  });
});
