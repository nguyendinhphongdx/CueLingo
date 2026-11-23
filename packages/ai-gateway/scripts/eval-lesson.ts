/* Live eval for the goal lesson tasks (ADR 0025, AC13):
   pnpm --filter @cuelingo/api exec tsx ../../packages/ai-gateway/scripts/eval-lesson.ts
   Model comes from AI_LESSON_MODEL, key from GEMINI_API_KEY. It calls the real provider and costs money
   (about 0.02 USD per generated lesson), so it is never run by CI.

   Thresholds (exit code 1 when one fails):
   - structure: 100% of generated lessons pass the schema and `checkLessonOutput`;
   - feedback: p95 <= 5000 ms and every answer passes `checkFeedbackOutput`;
   - on goal, English and Vietnamese quality: a person grades the printed samples, at least 90% must pass
     (this script cannot judge them). */
import {
  checkFeedbackOutput,
  checkLessonOutput,
  feedbackFixtures,
  LessonFeedbackOutputSchema,
  LessonOutputSchema,
} from '@cuelingo/prompts';
import { GOAL_CATALOG, type GoalLevel } from '@cuelingo/shared';
import { createAiGateway } from '../src/gateway';
import { TASKS } from '../src/tasks';

const key = process.env.GEMINI_API_KEY?.trim();
if (!key) throw new Error('GEMINI_API_KEY is not set');
const gateway = createAiGateway({ googleApiKey: key });

const LEVELS: GoalLevel[] = ['a2', 'b2'];
const RUNS = 2;
const FEEDBACK_RUNS = 3;
const STRUCTURE_MIN = 1;
const FEEDBACK_P95_MAX_MS = 5_000;

let generated = 0;
let wellFormed = 0;
for (const goal of GOAL_CATALOG) {
  const lessonKey = goal.lessons[0].key;
  for (const level of LEVELS) {
    for (let run = 0; run < RUNS; run += 1) {
      generated += 1;
      const label = `${goal.key}/${lessonKey} ${level} #${run + 1}`;
      try {
        const lesson = await gateway.json(
          'lesson.generate',
          { goalKey: goal.key, lessonKey, level, language: 'en' },
          LessonOutputSchema,
        );
        const check = checkLessonOutput(lesson);
        if (check.ok) wellFormed += 1;
        console.warn(`${check.ok ? 'PASS' : `FAIL(${check.reason})`} ${label}`);
        // One sample per cell goes to the grader: situation, three dialogue lines, one question.
        if (run === 0) {
          console.warn(`  situation: ${lesson.situation.descriptionVi}`);
          console.warn(`  phrases: ${lesson.situation.keyPhrases.map((p) => p.en).join(' | ')}`);
          for (const turn of lesson.dialogue.turns.slice(0, 3))
            console.warn(`  ${turn.speaker}: ${turn.en} / ${turn.vi}`);
          const question = lesson.quiz.questions[0]!;
          console.warn(`  quiz: ${question.prompt} -> ${question.answer}`);
        }
      } catch (error) {
        console.warn(`FAIL(${error instanceof Error ? error.message : 'error'}) ${label}`);
      }
    }
  }
}

const latencies: number[] = [];
let feedbackTotal = 0;
let feedbackOk = 0;
for (const fixture of feedbackFixtures) {
  for (let run = 0; run < FEEDBACK_RUNS; run += 1) {
    feedbackTotal += 1;
    const started = performance.now();
    try {
      const out = await gateway.json('lesson.feedback', fixture.input, LessonFeedbackOutputSchema);
      latencies.push(Math.round(performance.now() - started));
      if (checkFeedbackOutput(out).ok) feedbackOk += 1;
      if (run === 0) console.warn(`${fixture.name}: ${out.verdict} -> ${out.better}`);
    } catch {
      latencies.push(Math.round(performance.now() - started));
    }
  }
}
latencies.sort((a, b) => a - b);
const pct = (p: number) =>
  latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))] ?? 0;

const structure = generated === 0 ? 0 : wellFormed / generated;
const p95 = pct(0.95);
console.warn(
  `model=${TASKS['lesson.generate'].model} structure=${wellFormed}/${generated} ` +
    `feedback=${feedbackOk}/${feedbackTotal} p50=${pct(0.5)}ms p95=${p95}ms (limit ${FEEDBACK_P95_MAX_MS}ms)`,
);
console.warn(
  'Human grading still needed: on goal, English grammar, natural Vietnamese (>= 90% pass).',
);
if (structure < STRUCTURE_MIN || p95 > FEEDBACK_P95_MAX_MS || feedbackOk < feedbackTotal)
  process.exitCode = 1;
