import {
  findCatalogGoal,
  findCatalogLesson,
  LessonContentSchema,
  type GoalKey,
  type GoalLanguage,
  type GoalLevel,
  type LessonContent,
} from '@cuelingo/shared';
import { promptLanguage } from '../language';

export const LESSON_PROMPT_VERSION = 'lesson.generate@v1';

/** Output of the task: the four parts of one lesson. The schema lives in the contract. */
export const LessonOutputSchema = LessonContentSchema;
export type LessonOutput = LessonContent;

/**
 * The only things a shared lesson is made from (ADR 0025): keys of the catalog, a level and a language.
 * There is no field for text of a person, so none can reach content that other people will read.
 */
export interface LessonPromptInput {
  goalKey: GoalKey;
  lessonKey: string;
  level: GoalLevel;
  language: GoalLanguage;
}

const LEVELS: Record<GoalLevel, string> = {
  a2: 'A2 (elementary): short sentences, common words, present and simple past, no idioms; 6 to 10 words per line.',
  b1: 'B1 (intermediate): everyday workplace English, simple connectors, a few common phrasal verbs; up to 14 words per line.',
  b2: 'B2 (upper intermediate): natural workplace English, polite hedging, common idioms; up to 20 words per line.',
  c1: 'C1 (advanced): fluent and precise workplace English, nuance, diplomacy; lines may be longer, but stay speakable.',
};

const system = (input: LessonPromptInput) => {
  const goal = findCatalogGoal(input.goalKey);
  const lesson = findCatalogLesson(input.goalKey, input.lessonKey);
  const language = promptLanguage(input.language);
  if (!goal || !lesson) throw new Error('Lesson is not in the catalog');
  return [
    `You write one lesson of a ${language} course for Vietnamese software professionals.`,
    `Goal of the course: ${goal.situationEn}.`,
    `Topic of this lesson: ${lesson.focusEn}.`,
    `Level: ${LEVELS[input.level]}`,
    'The lesson has exactly four parts, returned as one JSON object with these keys and no others:',
    `1. "situation": {"descriptionVi": 2 to 4 Vietnamese sentences that set the scene and say what the learner will be able to do (max 600 characters), "keyPhrases": 5 to 8 of {"en": a ${language} phrase or sentence frame of 2 to 8 words, "meaningVi": its meaning in Vietnamese, "register": "formal" | "neutral" | "casual"}}.`,
    `2. "dialogue": {"roles": {"a": a short role name in ${language}, "b": a short role name in ${language}}, "turns": 6 to 10 of {"speaker": "a" | "b", "en": one natural ${language} line, "vi": its Vietnamese translation}}. The speakers alternate. At least 4 of the key phrases appear word for word in the "en" lines.`,
    '3. "practice": {"prompts": exactly 3 of {"taskVi": a Vietnamese instruction asking the learner to write one sentence in a concrete situation, "targetPhrase": one of the key phrases to use, "hintEn": optional short hint in English}}.',
    '4. "quiz": {"questions": exactly 6 of {"kind": "choice" | "cloze", "prompt": string, "options": 3 or 4 distinct strings, "answer": one of the options copied exactly, "explanationVi": a Vietnamese explanation of 1 to 2 sentences, "phrase": the key phrase the question tests, copied exactly from keyPhrases}}.',
    'A "choice" question gives a key phrase in the prompt and asks for its Vietnamese meaning among the options, or gives a Vietnamese situation and asks which English phrase fits. A "cloze" question gives a natural English sentence with the key phrase replaced by ____ (exactly once) and English options. Use both kinds. Wrong options must be plausible but clearly wrong.',
    `Write the ${language} parts in correct, natural ${language} that people really say at work. Write every "Vi" field in natural Vietnamese with full diacritics, not word-for-word.`,
    'Stay on the topic of this lesson and the goal. Never invent real people, companies or private details. Never output placeholders such as [Name] or {{x}}.',
    'Return only one valid JSON object, with no Markdown fences and no extra fields.',
  ].join('\n');
};

export function buildLessonPrompt(input: LessonPromptInput) {
  return {
    system: system(input),
    prompt: `Write the lesson now. Goal: ${input.goalKey}. Lesson: ${input.lessonKey}. Level: ${input.level}.`,
  };
}

export type LessonCheckFailure =
  | 'placeholder'
  | 'vietnamese-in-english'
  | 'english-in-vietnamese'
  | 'phrases-not-in-dialogue'
  | 'unknown-phrase'
  | 'bad-answer'
  | 'bad-cloze'
  | 'duplicate-options'
  | 'one-speaker'
  | 'duplicate-question';

const VI_MARKS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/iu;
const PLACEHOLDER = [/\[[^\]\n]{1,30}\]/u, /\{\{.*?\}\}/u, /<[^>\n]{1,30}>/u];
const norm = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
/** The share of Vietnamese lines that may lack a diacritic ("OK.", "Vâng" has one, "Ok" does not). */
const VI_SHARE = 0.8;

/**
 * Meaning rules the schema cannot express. The caller retries once and does not store a lesson that fails
 * (AC4). A failure here means the model wrote something a learner should not see.
 */
export function checkLessonOutput(
  content: LessonContent,
): { ok: true } | { ok: false; reason: LessonCheckFailure } {
  const { situation, dialogue, practice, quiz } = content;
  const all = JSON.stringify(content);
  if (PLACEHOLDER.some((pattern) => pattern.test(all))) return { ok: false, reason: 'placeholder' };

  const english = [
    ...situation.keyPhrases.map((p) => p.en),
    ...dialogue.turns.map((t) => t.en),
    ...practice.prompts.map((p) => p.targetPhrase),
    ...quiz.questions.filter((q) => q.kind === 'cloze').flatMap((q) => [q.prompt, ...q.options]),
    dialogue.roles.a,
    dialogue.roles.b,
  ];
  if (english.some((text) => VI_MARKS.test(text)))
    return { ok: false, reason: 'vietnamese-in-english' };

  const mustBeVietnamese = [
    situation.descriptionVi,
    ...practice.prompts.map((p) => p.taskVi),
    ...quiz.questions.map((q) => q.explanationVi),
  ];
  const shortVietnamese = [
    ...situation.keyPhrases.map((p) => p.meaningVi),
    ...dialogue.turns.map((t) => t.vi),
  ];
  const withMarks = shortVietnamese.filter((text) => VI_MARKS.test(text)).length;
  if (
    mustBeVietnamese.some((text) => !VI_MARKS.test(text)) ||
    withMarks < shortVietnamese.length * VI_SHARE
  )
    return { ok: false, reason: 'english-in-vietnamese' };

  if (new Set(dialogue.turns.map((t) => t.speaker)).size < 2)
    return { ok: false, reason: 'one-speaker' };

  const spoken = norm(dialogue.turns.map((t) => t.en).join(' '));
  const keys = situation.keyPhrases.map((p) => norm(p.en));
  if (keys.filter((key) => key && spoken.includes(key)).length < 4)
    return { ok: false, reason: 'phrases-not-in-dialogue' };

  const known = new Set(keys);
  if (
    practice.prompts.some((p) => !known.has(norm(p.targetPhrase))) ||
    quiz.questions.some((q) => !known.has(norm(q.phrase)))
  )
    return { ok: false, reason: 'unknown-phrase' };

  for (const question of quiz.questions) {
    if (new Set(question.options.map(norm)).size !== question.options.length)
      return { ok: false, reason: 'duplicate-options' };
    if (!question.options.includes(question.answer)) return { ok: false, reason: 'bad-answer' };
    const blanks = question.prompt.split('____').length - 1;
    if (question.kind === 'cloze' && blanks !== 1) return { ok: false, reason: 'bad-cloze' };
    if (question.kind === 'choice' && blanks !== 0) return { ok: false, reason: 'bad-cloze' };
  }
  if (new Set(quiz.questions.map((q) => norm(q.prompt))).size !== quiz.questions.length)
    return { ok: false, reason: 'duplicate-question' };
  return { ok: true };
}
