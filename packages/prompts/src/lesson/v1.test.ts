import { describe, expect, it } from 'vitest';
import { LessonContentSchema, type LessonContent } from '@cuelingo/shared';
import { lessonFixtures, lessonSample } from './fixtures/cases';
import { buildLessonPrompt, checkLessonOutput, LESSON_PROMPT_VERSION } from './v1';

const copy = (): LessonContent => structuredClone(lessonSample);
const reason = (content: LessonContent) => {
  const result = checkLessonOutput(content);
  return result.ok ? 'ok' : result.reason;
};

describe('lesson.generate v1', () => {
  it('is versioned and asks for four parts as one JSON object', () => {
    const { system } = buildLessonPrompt(lessonFixtures[0]!.input);
    expect(LESSON_PROMPT_VERSION).toBe('lesson.generate@v1');
    for (const part of ['"situation"', '"dialogue"', '"practice"', '"quiz"']) {
      expect(system).toContain(part);
    }
    expect(system).toContain('valid JSON object');
  });

  it('builds a prompt for every fixture from catalog keys, level and language only', () => {
    for (const { input } of lessonFixtures) {
      const { system, prompt } = buildLessonPrompt(input);
      expect(system).toContain(input.level.toUpperCase());
      expect(prompt).toContain(input.lessonKey);
    }
    expect(buildLessonPrompt(lessonFixtures[0]!.input).system).toContain(
      'reporting what you finished',
    );
  });

  it('rejects a lesson outside the catalog', () => {
    expect(() =>
      buildLessonPrompt({ goalKey: 'standup', lessonKey: 'nope', level: 'b1', language: 'en' }),
    ).toThrow();
  });

  it('the sample passes the schema and the check', () => {
    expect(LessonContentSchema.safeParse(lessonSample).success).toBe(true);
    expect(checkLessonOutput(lessonSample)).toEqual({ ok: true });
  });

  it('catches a placeholder', () => {
    const content = copy();
    content.dialogue.turns[0]!.en = 'Hello [Name], how are you?';
    expect(reason(content)).toBe('placeholder');
  });

  it('catches Vietnamese in an English field and English in a Vietnamese one', () => {
    const vi = copy();
    vi.dialogue.turns[1]!.en = 'Tôi đã hoàn thành';
    expect(reason(vi)).toBe('vietnamese-in-english');
    const en = copy();
    en.situation.descriptionVi = 'You are at the morning stand-up meeting.';
    expect(reason(en)).toBe('english-in-vietnamese');
  });

  it('catches a dialogue where one person speaks, and key phrases that are not said', () => {
    const one = copy();
    one.dialogue.turns.forEach((turn) => (turn.speaker = 'a'));
    expect(reason(one)).toBe('one-speaker');
    const unsaid = copy();
    unsaid.dialogue.turns.forEach((turn, i) => (turn.en = `Line number ${i}.`));
    expect(reason(unsaid)).toBe('phrases-not-in-dialogue');
  });

  it('catches a question about a phrase that is not a key phrase', () => {
    const content = copy();
    content.quiz.questions[0]!.phrase = 'something else';
    expect(reason(content)).toBe('unknown-phrase');
    const target = copy();
    target.practice.prompts[0]!.targetPhrase = 'something else';
    expect(reason(target)).toBe('unknown-phrase');
  });

  it('catches an answer that is not an option and duplicate options', () => {
    const answer = copy();
    answer.quiz.questions[0]!.answer = 'tôi đã hoàn tất';
    expect(reason(answer)).toBe('bad-answer');
    const options = copy();
    options.quiz.questions[0]!.options = ['tôi đã hoàn thành', 'Tôi đã hoàn thành', 'khác'];
    expect(reason(options)).toBe('duplicate-options');
  });

  it('catches a cloze without exactly one blank and a choice with one', () => {
    const cloze = copy();
    cloze.quiz.questions[2]!.prompt = 'I finished the login page yesterday.';
    expect(reason(cloze)).toBe('bad-cloze');
    const choice = copy();
    choice.quiz.questions[0]!.prompt = 'I ____';
    expect(reason(choice)).toBe('bad-cloze');
  });

  it('catches the same question twice', () => {
    const content = copy();
    content.quiz.questions[1] = { ...content.quiz.questions[0]! };
    expect(reason(content)).toBe('duplicate-question');
  });
});
