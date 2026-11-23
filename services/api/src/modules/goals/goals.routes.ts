import {
  CreateGoalRequestSchema,
  LessonKeySchema,
  LessonReportRequestSchema,
  PracticeRequestSchema,
  QuizSubmitRequestSchema,
  UpdateGoalRequestSchema,
  type Goal,
  type GoalList,
  type LessonView,
  type PracticeFeedback,
  type QuizResult,
} from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { IdParamsSchema, parse } from '../../lib/http';
import type { GoalsService } from './goals.service';

const LessonParamsSchema = z.object({ id: z.uuid(), lessonKey: LessonKeySchema });

/**
 * HTTP surface only. Logs carry ids, verdicts, counts and sizes: never a typed sentence, a question
 * or the feedback (AC12). The request body is also redacted by the app logger.
 */
export function goalsRoutes(service: GoalsService): FastifyPluginAsync {
  return async (app) => {
    app.get('/', async (request): Promise<GoalList> => service.list(request.userId));

    app.post('/', async (request, reply): Promise<Goal> => {
      const input = parse(CreateGoalRequestSchema, request.body);
      const goal = await service.create(request.userId, input);
      request.log.info({ goalId: goal.id, goalKey: goal.goalKey }, 'goal created');
      reply.code(201);
      return goal;
    });

    app.patch('/:id', async (request): Promise<Goal> => {
      const { id } = parse(IdParamsSchema, request.params);
      const patch = parse(UpdateGoalRequestSchema, request.body);
      return service.update(request.userId, id, patch);
    });

    app.delete('/:id', async (request, reply) => {
      const { id } = parse(IdParamsSchema, request.params);
      await service.remove(request.userId, id);
      return reply.code(204).send();
    });

    app.get('/:id/lessons/:lessonKey', async (request): Promise<LessonView> => {
      const { id, lessonKey } = parse(LessonParamsSchema, request.params);
      const started = performance.now();
      const lesson = await service.openLesson(request.userId, id, lessonKey);
      request.log.info(
        {
          goalId: id,
          lessonKey,
          promptVersion: lesson.promptVersion,
          ms: Math.round(performance.now() - started),
        },
        'goal lesson opened',
      );
      return lesson;
    });

    app.post('/:id/lessons/:lessonKey/practice', async (request): Promise<PracticeFeedback> => {
      const { id, lessonKey } = parse(LessonParamsSchema, request.params);
      const input = parse(PracticeRequestSchema, request.body);
      const started = performance.now();
      const feedback = await service.practice(request.userId, id, lessonKey, input);
      request.log.info(
        {
          goalId: id,
          lessonKey,
          verdict: feedback.verdict,
          ms: Math.round(performance.now() - started),
        },
        'goal practice',
      );
      return feedback;
    });

    app.post('/:id/lessons/:lessonKey/quiz', async (request): Promise<QuizResult> => {
      const { id, lessonKey } = parse(LessonParamsSchema, request.params);
      const input = parse(QuizSubmitRequestSchema, request.body);
      const result = await service.submitQuiz(request.userId, id, lessonKey, input);
      request.log.info(
        { goalId: id, lessonKey, correct: result.correct, passed: result.passed },
        'goal quiz',
      );
      return result;
    });

    app.post('/:id/lessons/:lessonKey/report', async (request, reply) => {
      const { id, lessonKey } = parse(LessonParamsSchema, request.params);
      const input = parse(LessonReportRequestSchema, request.body);
      const { retired } = await service.report(request.userId, id, lessonKey, input);
      request.log.info({ goalId: id, lessonKey, reason: input.reason, retired }, 'goal report');
      return reply.code(204).send();
    });
  };
}
