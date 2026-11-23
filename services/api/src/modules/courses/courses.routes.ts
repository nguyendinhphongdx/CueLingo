import {
  DEFAULT_LANGUAGE,
  LanguageQuerySchema,
  PrepCourseRequestSchema,
  type Course,
  type CourseList,
  type PrepCourse,
  type ReviewQueue,
  type StartCourseResponse,
} from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { IdParamsSchema, parse } from '../../lib/http';
import { QueueQuerySchema } from '../review';
import type { CoursesService } from './courses.service';

/**
 * HTTP surface only. The course id is the meeting id. Logs carry ids and counts, never phrases,
 * sentences or titles. Answers go to `POST /v1/review/answer`; there is no scorer here.
 */
export function coursesRoutes(service: CoursesService): FastifyPluginAsync {
  return async (app) => {
    app.get('/', async (request): Promise<CourseList> => {
      const { language } = parse(LanguageQuerySchema, request.query);
      return service.list(request.userId, language);
    });

    app.post('/prep', async (request): Promise<PrepCourse> => {
      const { sessionIds, language } = parse(PrepCourseRequestSchema, request.body);
      const prep = await service.prep(request.userId, {
        sessionIds,
        language: language ?? DEFAULT_LANGUAGE,
      });
      request.log.info(
        { sessions: sessionIds.length, lessons: prep.lessons.length },
        'course prep',
      );
      return prep;
    });

    app.get('/:id', async (request): Promise<Course> => {
      const { id } = parse(IdParamsSchema, request.params);
      return service.get(request.userId, id);
    });

    app.post('/:id/start', async (request): Promise<StartCourseResponse> => {
      const { id } = parse(IdParamsSchema, request.params);
      const result = await service.start(request.userId, id);
      request.log.info({ sessionId: id, added: result.added }, 'course started');
      return result;
    });

    // `language` is accepted like on the daily queue but the course's own language is used.
    app.get('/:id/queue', async (request): Promise<ReviewQueue> => {
      const { id } = parse(IdParamsSchema, request.params);
      const { dictation } = parse(QueueQuerySchema, request.query);
      return service.queue(request.userId, id, { dictation });
    });
  };
}
