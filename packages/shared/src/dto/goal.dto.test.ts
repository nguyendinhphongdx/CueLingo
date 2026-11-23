import { describe, expect, it } from 'vitest';
import { GOAL_CATALOG, GOAL_LESSON_COUNT, findCatalogLesson, GOAL_KEYS } from '../goals';
import {
  CreateGoalRequestSchema,
  LessonContentSchema,
  PracticeRequestSchema,
  QuizSubmitRequestSchema,
  UpdateGoalRequestSchema,
  type LessonContent,
} from './goal.dto';

const phrase = (n: number) => ({ en: `phrase ${n}`, meaningVi: `nghĩa ${n}`, register: 'neutral' });
const question = (n: number) => ({
  kind: 'choice',
  prompt: `Câu ${n}`,
  options: ['a', 'b', 'c'],
  answer: 'a',
  explanationVi: 'Vì sao',
  phrase: `phrase ${n}`,
});

const validContent = (): LessonContent =>
  ({
    situation: { descriptionVi: 'Tình huống', keyPhrases: [1, 2, 3, 4, 5].map(phrase) },
    dialogue: {
      roles: { a: 'Dev', b: 'Lead' },
      turns: Array.from({ length: 6 }, (_, i) => ({
        speaker: i % 2 ? 'b' : 'a',
        en: `Line ${i}`,
        vi: `Dòng ${i}`,
      })),
    },
    practice: {
      prompts: [1, 2, 3].map((n) => ({ taskVi: `Việc ${n}`, targetPhrase: `phrase ${n}` })),
    },
    quiz: { questions: [1, 2, 3, 4, 5, 6].map(question) },
  }) as LessonContent;

describe('goal catalog', () => {
  it('has 8 goals of 6 lessons with unique keys', () => {
    expect(GOAL_CATALOG).toHaveLength(8);
    expect(new Set(GOAL_KEYS).size).toBe(8);
    for (const goal of GOAL_CATALOG) {
      expect(goal.lessons).toHaveLength(GOAL_LESSON_COUNT);
      expect(new Set(goal.lessons.map((l) => l.key)).size).toBe(GOAL_LESSON_COUNT);
    }
  });
  it('finds a lesson by goal and key', () => {
    expect(findCatalogLesson('standup', 'done')?.titleVi).toBe('Báo việc đã làm');
    expect(findCatalogLesson('standup', 'nope')).toBeUndefined();
    expect(findCatalogLesson('nope', 'done')).toBeUndefined();
  });
});

describe('CreateGoalRequestSchema', () => {
  it('rejects a goal outside the catalog', () => {
    expect(CreateGoalRequestSchema.safeParse({ goalKey: 'cooking' }).success).toBe(false);
  });
  it('takes the deadline as optional', () => {
    expect(CreateGoalRequestSchema.parse({ goalKey: 'demo' })).toEqual({ goalKey: 'demo' });
    expect(
      CreateGoalRequestSchema.parse({ goalKey: 'demo', deadline: '2026-12-01', level: 'b2' }),
    ).toEqual({ goalKey: 'demo', deadline: '2026-12-01', level: 'b2' });
  });
  it('rejects a bad date, an unknown level and extra fields', () => {
    expect(CreateGoalRequestSchema.safeParse({ goalKey: 'demo', deadline: 'soon' }).success).toBe(
      false,
    );
    expect(CreateGoalRequestSchema.safeParse({ goalKey: 'demo', level: 'z9' }).success).toBe(false);
    expect(CreateGoalRequestSchema.safeParse({ goalKey: 'demo', userId: 'x' }).success).toBe(false);
  });
});

describe('UpdateGoalRequestSchema', () => {
  it('needs something to change and lets the deadline be cleared', () => {
    expect(UpdateGoalRequestSchema.safeParse({}).success).toBe(false);
    expect(UpdateGoalRequestSchema.parse({ deadline: null })).toEqual({ deadline: null });
  });
});

describe('LessonContentSchema', () => {
  it('accepts a full lesson', () => {
    expect(LessonContentSchema.safeParse(validContent()).success).toBe(true);
  });
  it.each(['situation', 'dialogue', 'practice', 'quiz'] as const)(
    'rejects a lesson without %s',
    (part) => {
      const content: Record<string, unknown> = { ...validContent() };
      delete content[part];
      expect(LessonContentSchema.safeParse(content).success).toBe(false);
    },
  );
  it('rejects 5 questions and an extra field', () => {
    const short = validContent();
    short.quiz.questions.pop();
    expect(LessonContentSchema.safeParse(short).success).toBe(false);
    expect(LessonContentSchema.safeParse({ ...validContent(), extra: 1 }).success).toBe(false);
  });
});

describe('PracticeRequestSchema and QuizSubmitRequestSchema', () => {
  it('trims the sentence and bounds it', () => {
    expect(PracticeRequestSchema.parse({ promptIndex: 0, sentence: '  Hi  ' }).sentence).toBe('Hi');
    expect(PracticeRequestSchema.safeParse({ promptIndex: 3, sentence: 'x' }).success).toBe(false);
    expect(
      PracticeRequestSchema.safeParse({ promptIndex: 0, sentence: 'x'.repeat(301) }).success,
    ).toBe(false);
  });
  it('needs one answer for each of the six questions', () => {
    const answers = [0, 1, 2, 3, 4, 5].map((question) => ({ question, choice: 0 }));
    expect(QuizSubmitRequestSchema.safeParse({ answers }).success).toBe(true);
    expect(QuizSubmitRequestSchema.safeParse({ answers: answers.slice(1) }).success).toBe(false);
    const twice = answers.map((a, i) => (i === 5 ? { ...a, question: 0 } : a));
    expect(QuizSubmitRequestSchema.safeParse({ answers: twice }).success).toBe(false);
  });
});
