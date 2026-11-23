import { TASKS, type AiGateway } from '@cuelingo/ai-gateway';
import {
  defaultGoalLevel,
  goalLessonStatus,
  goalProgress,
  pickGoalNextUp,
  quizRating,
  scoreQuiz,
  shouldRetire,
  PASS_CORRECT,
} from '@cuelingo/learner-model';
import {
  checkFeedbackOutput,
  checkLessonOutput,
  checkPersonalOutput,
  LESSON_PERSONALIZE_PROMPT_VERSION,
  LESSON_PROMPT_VERSION,
  LessonFeedbackOutputSchema,
  LessonOutputSchema,
  LessonPersonalizeOutputSchema,
} from '@cuelingo/prompts';
import {
  DEFAULT_GOAL_LANGUAGE,
  ErrorCode,
  findCatalogGoal,
  findCatalogLesson,
  GOAL_MAX,
  normalizePhrase,
  type CreateGoalRequest,
  type ExerciseType,
  type Goal,
  type GoalLanguage,
  type GoalList,
  type LanguageCode,
  type LessonContent,
  type LessonPersonal,
  type LessonReportRequest,
  type LessonView,
  type Phrase,
  type PracticeFeedback,
  type PracticeRequest,
  type QuizResult,
  type QuizSubmitRequest,
  type ReviewAnswerRequest,
  type SavePhraseRequest,
  type UpdateGoalRequest,
  type UsageItem,
  type UsageMetric,
  type UsageResponse,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { StudyItem } from '../review';
import type { GoalLessonRow, GoalRow, GoalsRepository, LessonContentRow } from './goals.repository';

export type GoalsService = ReturnType<typeof createGoalsService>;

/** What the service takes from other modules; wired in `app.ts`. */
export interface GoalsPorts {
  /** Counting and the quota gate: `status` before the work, `add` only after it worked (AC9). */
  usage: {
    status(userId: string, metric: UsageMetric): Promise<UsageItem>;
    add(
      userId: string,
      metric: UsageMetric,
      amount: number,
      limit: number | null,
    ): Promise<UsageItem>;
    snapshot(userId: string): Promise<UsageResponse>;
  };
  listItems(userId: string, language: LanguageCode): Promise<StudyItem[]>;
  savePhrase(userId: string, input: SavePhraseRequest): Promise<Phrase>;
  answer(userId: string, input: ReviewAnswerRequest): Promise<unknown>;
  /** The person's own terms: glossary and Phrase Bank. Sent to the AI only for the personal examples. */
  listTerms(
    userId: string,
    language: GoalLanguage,
  ): Promise<Array<{ term: string; translation: string | null }>>;
}

export interface GoalsDeps {
  /** Missing = lessons cannot be made or practised; goals, opened lessons and quizzes still work. */
  gateway?: Pick<AiGateway, 'json'>;
  /**
   * False: new lessons cannot be opened and sentences cannot be practised (503 LESSONS_DISABLED); goals, lessons
   * already opened and quizzes keep working. Env `GOAL_LESSONS_ENABLED`; default true here, `config.ts` decides.
   */
  enabled?: boolean;
  /** Feedback requests one person may make per `windowMs`. */
  maxPracticePerWindow?: number;
  /** First opens of a lesson that need the model, per person per `windowMs`. */
  maxOpensPerWindow?: number;
  windowMs?: number;
  /** A cell that just failed is not asked again for this long. */
  failureCooldownMs?: number;
  /** The most one request waits for a new lesson (under the 100 s limit of the proxy) or for feedback. */
  lessonDeadlineMs?: number;
  feedbackDeadlineMs?: number;
  clock?: () => number;
}

const MAX_TRACKED_USERS = 5_000;
/** The lesson content is tried this many times (each try is itself two model answers at most). */
const LESSON_ATTEMPTS = 2;
const FEEDBACK_ATTEMPTS = 2;
const MAX_FAILED_CELLS = 500;

/** True when the gateway gave up because its time ran out; asking again would only wait as long again. */
function isTimeout(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    if (current.name === 'TimeoutError' || current.name === 'AbortError') return true;
    current = current.cause;
  }
  return false;
}

/** Rejects with `onTimeout()` when `work` is not done in `ms`. `work` itself is not stopped. */
function withDeadline<T>(work: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(onTimeout()), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

const notFound = () => new AppError(ErrorCode.NotFound, 'Goal or lesson not found');

export function createGoalsService(
  repo: GoalsRepository,
  ports: GoalsPorts,
  {
    gateway,
    enabled = true,
    maxPracticePerWindow = 12,
    maxOpensPerWindow = 3,
    windowMs = 60_000,
    failureCooldownMs = 60_000,
    lessonDeadlineMs = 28_000,
    feedbackDeadlineMs = 8_000,
    clock = Date.now,
  }: GoalsDeps = {},
) {
  // Several people opening the same cell at once make the content once.
  const inFlight = new Map<string, Promise<LessonContentRow>>();
  // In memory and per process: it only has to stop one account from using this as free text generation.
  function createLimiter(max: number, message: string) {
    const recent = new Map<string, number[]>();
    let lastSweep = clock();
    return (userId: string) => {
      const now = clock();
      if (now - lastSweep >= windowMs) {
        lastSweep = now;
        for (const [id, stamps] of recent) {
          if (stamps.every((time) => now - time >= windowMs)) recent.delete(id);
        }
      }
      const times = (recent.get(userId) ?? []).filter((time) => now - time < windowMs);
      if (times.length >= max) {
        recent.set(userId, times);
        throw new AppError(ErrorCode.RateLimited, message);
      }
      recent.delete(userId);
      recent.set(userId, [...times, now]);
      if (recent.size > MAX_TRACKED_USERS) recent.delete(recent.keys().next().value!);
    };
  }
  const takeSlot = createLimiter(maxPracticePerWindow, 'Too many practice requests, slow down');
  const takeOpenSlot = createLimiter(
    maxOpensPerWindow,
    'Bạn mở bài mới hơi nhiều trong một phút, đợi một chút rồi thử lại',
  );
  // Cells whose last try failed: not asked again until the time in the map.
  const failedUntil = new Map<string, number>();

  function assertEnabled() {
    if (!enabled) {
      throw new AppError(ErrorCode.LessonsDisabled, 'Tính năng bài học theo mục tiêu chưa mở');
    }
  }

  /** Refuses with 429 when the allowance of today is used up. Never counts. */
  async function assertAllowance(userId: string, metric: UsageMetric): Promise<UsageItem> {
    const item = await ports.usage.status(userId, metric);
    if (item.state === 'exhausted' && item.limit !== null) {
      const { plan } = await ports.usage.snapshot(userId);
      throw new AppError(ErrorCode.QuotaExceeded, 'Usage allowance used up', {
        metric,
        plan,
        used: item.used,
        limit: item.limit,
        resetsAt: item.resetsAt,
      });
    }
    return item;
  }

  const toGoal = (row: GoalRow, lessons: GoalLessonRow[]): Goal => {
    const catalog = findCatalogGoal(row.goalKey)!;
    const summaries = catalog.lessons.map((lesson) => {
      const own = lessons.find((candidate) => candidate.lessonKey === lesson.key);
      return {
        lessonKey: lesson.key,
        titleVi: lesson.titleVi,
        status: goalLessonStatus(own),
        bestCorrect: own?.bestCorrect ?? null,
      };
    });
    const progress = goalProgress(summaries);
    return {
      id: row.id,
      goalKey: row.goalKey as Goal['goalKey'],
      titleVi: catalog.titleVi,
      language: row.language,
      level: row.level,
      deadline: row.deadline,
      createdAt: row.createdAt.toISOString(),
      lessonCount: progress.total,
      doneCount: progress.done,
      progressPct: progress.pct,
      lessons: summaries,
    };
  };

  async function ownGoal(userId: string, id: string): Promise<GoalRow> {
    const goal = await repo.findGoal(userId, id);
    // One answer for "not yours" and "does not exist": it must not reveal which ids exist.
    if (!goal || !findCatalogGoal(goal.goalKey)) throw notFound();
    return goal;
  }

  /** The goal, the catalog lesson and the row of a lesson the person already opened. */
  async function openedLesson(userId: string, goalId: string, lessonKey: string) {
    const goal = await ownGoal(userId, goalId);
    const catalog = findCatalogLesson(goal.goalKey, lessonKey);
    const lesson = catalog ? await repo.findLesson(userId, goalId, lessonKey) : null;
    const content = lesson ? await repo.findContent(lesson.contentId) : null;
    if (!catalog || !lesson || !content) throw notFound();
    return { goal, catalog, lesson, content };
  }

  function view(
    goal: GoalRow,
    titleVi: string,
    lesson: GoalLessonRow,
    row: LessonContentRow,
  ): LessonView {
    const { situation, dialogue, practice, quiz } = row.content;
    return {
      goalId: goal.id,
      lessonKey: lesson.lessonKey,
      titleVi,
      level: row.level,
      promptVersion: row.promptVersion,
      situation,
      dialogue,
      practice,
      // The answer and the explanation stay on the server until the person submits (AC7).
      quiz: {
        questions: quiz.questions.map(({ kind, prompt, options }) => ({ kind, prompt, options })),
      },
      examples: lesson.personal?.examples ?? [],
      status: goalLessonStatus(lesson),
      bestCorrect: lesson.bestCorrect,
      attempts: lesson.attempts,
    };
  }

  /** Makes the shared content of one cell: asks the model, checks the answer, stores it only when it is sound (AC4). */
  async function makeContent(
    userId: string,
    goal: GoalRow,
    lessonKey: string,
  ): Promise<LessonContentRow> {
    const existing = await repo.findLiveContent(goal.goalKey, lessonKey, goal.level, goal.language);
    if (existing) return existing;
    if (!gateway) throw new AppError(ErrorCode.LessonFailed, 'Lessons are not available');
    const cell = `${goal.goalKey}:${lessonKey}:${goal.level}:${goal.language}`;
    const pending = inFlight.get(cell);
    if (pending) return pending;
    // From here on the model is paid for: a cell that just failed waits, and one person cannot start many at once.
    const blockedUntil = failedUntil.get(cell) ?? 0;
    if (blockedUntil > clock()) {
      throw new AppError(
        ErrorCode.LessonFailed,
        'Bài này vừa soạn chưa được, đợi vài phút rồi thử lại; không bị tính vào hạn mức',
      );
    }
    takeOpenSlot(userId);
    const work = (async () => {
      // Only catalog keys, the level and the language go in: nothing of the person (ADR 0025).
      const input = {
        goalKey: goal.goalKey as Goal['goalKey'],
        lessonKey,
        level: goal.level,
        language: goal.language,
      };
      for (let attempt = 0; attempt < LESSON_ATTEMPTS; attempt += 1) {
        let content: LessonContent;
        try {
          content = await gateway.json('lesson.generate', input, LessonOutputSchema, { userId });
        } catch (error) {
          // Nothing from the provider error is forwarded: it may carry the lesson text.
          // A timeout is not tried again: the second try would wait as long and still fail.
          if (isTimeout(error)) break;
          continue;
        }
        if (!checkLessonOutput(content).ok) continue;
        const stored = await repo.insertContent({
          ...input,
          promptVersion: LESSON_PROMPT_VERSION,
          model: TASKS['lesson.generate'].model,
          content,
        });
        if (stored) return stored;
        break;
      }
      throw new AppError(ErrorCode.LessonFailed, 'Could not make the lesson');
    })().catch((error: unknown) => {
      if (failedUntil.size >= MAX_FAILED_CELLS) failedUntil.clear();
      failedUntil.set(cell, clock() + failureCooldownMs);
      throw error;
    });
    inFlight.set(cell, work);
    // Cleared when the work ends, not when the request that started it stops waiting.
    void work.then(
      () => inFlight.delete(cell),
      () => inFlight.delete(cell),
    );
    return work;
  }

  /** Examples with the person's own terms. A failure only means there are none: the lesson is complete without them. */
  async function personalize(
    userId: string,
    goal: GoalRow,
    lessonKey: string,
    content: LessonContent,
  ): Promise<{ personal: LessonPersonal; version: string | null }> {
    const terms = await ports.listTerms(userId, goal.language);
    if (!gateway || terms.length === 0) return { personal: { examples: [] }, version: null };
    try {
      const out = await gateway.json(
        'lesson.personalize',
        {
          goalKey: goal.goalKey as Goal['goalKey'],
          lessonKey,
          level: goal.level,
          keyPhrases: content.situation.keyPhrases.map((phrase) => phrase.en),
          terms,
        },
        LessonPersonalizeOutputSchema,
        { userId },
      );
      return {
        personal: checkPersonalOutput(out, terms),
        version: LESSON_PERSONALIZE_PROMPT_VERSION,
      };
    } catch {
      return { personal: { examples: [] }, version: null };
    }
  }

  return {
    async list(userId: string): Promise<GoalList> {
      const goals = await repo.listGoals(userId);
      const lessons = await repo.listLessons(
        userId,
        goals.map((goal) => goal.id),
      );
      const built = goals
        .filter((goal) => findCatalogGoal(goal.goalKey))
        .map((goal) =>
          toGoal(
            goal,
            lessons.filter((lesson) => lesson.goalId === goal.id),
          ),
        );
      const next = pickGoalNextUp(built);
      return {
        goals: built,
        nextUp: next && {
          goalId: next.goal.id,
          goalTitleVi: next.goal.titleVi,
          lessonKey: next.goal.lessons[next.lessonIndex]!.lessonKey,
          lessonTitleVi: next.goal.lessons[next.lessonIndex]!.titleVi,
        },
      };
    },

    async create(userId: string, input: CreateGoalRequest): Promise<Goal> {
      const language = input.language ?? DEFAULT_GOAL_LANGUAGE;
      const current = await repo.listGoals(userId);
      if (current.some((goal) => goal.goalKey === input.goalKey && goal.language === language)) {
        throw new AppError(ErrorCode.Conflict, 'You already have this goal');
      }
      if (current.length >= GOAL_MAX) {
        throw new AppError(ErrorCode.Conflict, `You can have at most ${GOAL_MAX} goals`);
      }
      const level = input.level ?? defaultGoalLevel(await repo.listeningLevel(userId, language));
      const created = await repo.createGoal(userId, {
        goalKey: input.goalKey,
        language,
        level,
        deadline: input.deadline ?? null,
      });
      // The unique index is the last word when two requests race.
      if (!created) throw new AppError(ErrorCode.Conflict, 'You already have this goal');
      return toGoal(created, []);
    },

    async update(userId: string, id: string, patch: UpdateGoalRequest): Promise<Goal> {
      const updated = await repo.updateGoal(userId, id, patch);
      if (!updated) throw notFound();
      return toGoal(updated, await repo.listLessons(userId, [id]));
    },

    async remove(userId: string, id: string): Promise<void> {
      if (!(await repo.deleteGoal(userId, id))) throw notFound();
    },

    /**
     * Opens a lesson. A lesson the person opened before comes back as it was, with no AI call and no count (AC10).
     * A first open takes one of today's new lessons, and only after everything worked (AC9).
     */
    async openLesson(userId: string, goalId: string, lessonKey: string): Promise<LessonView> {
      const goal = await ownGoal(userId, goalId);
      const catalog = findCatalogLesson(goal.goalKey, lessonKey);
      if (!catalog) throw notFound();

      const opened = await repo.findLesson(userId, goalId, lessonKey);
      if (opened) {
        const content = await repo.findContent(opened.contentId);
        if (!content) throw notFound();
        return view(goal, catalog.titleVi, opened, content);
      }

      assertEnabled();
      const allowance = await assertAllowance(userId, 'lessons_daily');
      const content = await withDeadline(
        makeContent(userId, goal, lessonKey),
        lessonDeadlineMs,
        () => new AppError(ErrorCode.LessonFailed, 'Bài mới soạn lâu quá, thử lại sau ít phút'),
      );
      const pinned = await repo.pinLesson(userId, goalId, lessonKey, content.id);
      if (!pinned) throw notFound();
      let lesson = pinned;
      // Two first opens at once (two tabs): only the request that writes the personal part counts the lesson.
      if (pinned.personal === null) {
        const { personal, version } = await personalize(userId, goal, lessonKey, content.content);
        if (await repo.setPersonal(userId, goalId, lessonKey, personal, version)) {
          lesson = { ...pinned, personal };
          await ports.usage.add(userId, 'lessons_daily', 1, allowance.limit);
        } else {
          lesson = (await repo.findLesson(userId, goalId, lessonKey)) ?? pinned;
        }
      }
      const pinnedContent =
        lesson.contentId === content.id ? content : await repo.findContent(lesson.contentId);
      if (!pinnedContent) throw notFound();
      return view(goal, catalog.titleVi, lesson, pinnedContent);
    },

    /** Feedback on one typed sentence. The sentence and the feedback are never stored. */
    async practice(
      userId: string,
      goalId: string,
      lessonKey: string,
      input: PracticeRequest,
    ): Promise<PracticeFeedback> {
      const { goal, content } = await openedLesson(userId, goalId, lessonKey);
      const prompt = content.content.practice.prompts[input.promptIndex];
      if (!prompt) throw new AppError(ErrorCode.Validation, 'Unknown practice prompt');
      assertEnabled();
      // After the lookups: a prober does not use up the slots of the person.
      takeSlot(userId);
      const allowance = await assertAllowance(userId, 'lesson_practice_daily');
      if (!gateway) throw new AppError(ErrorCode.LessonFailed, 'Practice is not available');

      const feedback = async (): Promise<PracticeFeedback | null> => {
        for (let attempt = 0; attempt < FEEDBACK_ATTEMPTS; attempt += 1) {
          let output: PracticeFeedback;
          try {
            output = await gateway.json(
              'lesson.feedback',
              {
                goalKey: goal.goalKey as Goal['goalKey'],
                level: goal.level,
                taskVi: prompt.taskVi,
                targetPhrase: prompt.targetPhrase,
                sentence: input.sentence,
              },
              LessonFeedbackOutputSchema,
              { userId },
            );
          } catch (error) {
            // A timeout is not tried again.
            if (isTimeout(error)) break;
            continue;
          }
          if (!checkFeedbackOutput(output).ok) continue;
          await ports.usage.add(userId, 'lesson_practice_daily', 1, allowance.limit);
          return output;
        }
        return null;
      };
      const given = await withDeadline(
        feedback(),
        feedbackDeadlineMs,
        () => new AppError(ErrorCode.LessonFailed, 'Could not give feedback in time'),
      );
      if (given) return given;
      throw new AppError(ErrorCode.LessonFailed, 'Could not give feedback');
    },

    /**
     * Grades the quiz on the server. Every answer goes through the ordinary review path (FSRS and a review log),
     * and the key phrases are saved to the Phrase Bank first. Doing it again is free.
     */
    async submitQuiz(
      userId: string,
      goalId: string,
      lessonKey: string,
      input: QuizSubmitRequest,
    ): Promise<QuizResult> {
      const { goal, content } = await openedLesson(userId, goalId, lessonKey);
      const { questions } = content.content.quiz;
      const choiceOf = new Map(input.answers.map((answer) => [answer.question, answer.choice]));
      const graded = questions.map((question, index) => {
        const choice = choiceOf.get(index);
        const correct = choice !== undefined && question.options[choice] === question.answer;
        return { question, correct, answerIndex: question.options.indexOf(question.answer) };
      });
      const score = scoreQuiz(graded.map((entry) => entry.correct));

      const language = goal.language as LanguageCode;
      const known = new Set(
        (await ports.listItems(userId, language)).map((item) => normalizePhrase(item.phrase)),
      );
      const itemOf = new Map<string, string>();
      let phrasesAdded = 0;
      for (const { question } of graded) {
        const key = normalizePhrase(question.phrase);
        if (itemOf.has(key)) continue;
        const keyPhrase = content.content.situation.keyPhrases.find(
          (candidate) => normalizePhrase(candidate.en) === key,
        );
        const sentence = content.content.dialogue.turns.find((turn) =>
          normalizePhrase(turn.en).includes(key),
        );
        const saved = await ports.savePhrase(userId, {
          phrase: question.phrase,
          ...(keyPhrase ? { meaningVi: keyPhrase.meaningVi.slice(0, 500) } : {}),
          ...(sentence ? { context: sentence.en.slice(0, 500) } : {}),
          language: goal.language,
        });
        itemOf.set(key, saved.id);
        if (!known.has(key)) phrasesAdded += 1;
      }
      for (const { question, correct } of graded) {
        const exercise: ExerciseType = question.kind === 'cloze' ? 'cloze' : 'recognize';
        await ports.answer(userId, {
          itemId: itemOf.get(normalizePhrase(question.phrase))!,
          exercise,
          rating: quizRating(correct),
        });
      }

      const recorded = await repo.recordQuiz(userId, goalId, lessonKey, {
        correct: score.correct,
        passed: score.passed,
        at: new Date(clock()),
      });
      return {
        correct: score.correct,
        total: score.total,
        passed: score.passed,
        passMark: PASS_CORRECT,
        bestCorrect: recorded?.bestCorrect ?? score.correct,
        results: graded.map((entry, index) => ({
          question: index,
          correct: entry.correct,
          answerIndex: entry.answerIndex,
          explanationVi: entry.question.explanationVi,
        })),
        phrasesAdded,
      };
    },

    /** One report per person and content version; the third different person takes the version out. */
    async report(
      userId: string,
      goalId: string,
      lessonKey: string,
      input: LessonReportRequest,
    ): Promise<{ retired: boolean }> {
      const { lesson } = await openedLesson(userId, goalId, lessonKey);
      const reporters = await repo.addReport(userId, lesson.contentId, input.reason);
      const retired = shouldRetire(reporters);
      if (retired) await repo.retireContent(lesson.contentId);
      return { retired };
    },
  };
}
