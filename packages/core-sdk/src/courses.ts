import {
  CourseListSchema,
  CourseSchema,
  PrepCourseSchema,
  ReviewQueueSchema,
  StartCourseResponseSchema,
  type Course,
  type CourseList,
  type LanguageCode,
  type PrepCourse,
  type PrepCourseRequest,
  type ReviewQueue,
  type StartCourseResponse,
} from '@cuelingo/shared';
import type { Http } from './http';

export function coursesApi(http: Http) {
  return {
    /** Courses of one language with progress and what to do next; the API assumes English when left out. */
    list(language?: LanguageCode): Promise<CourseList> {
      const query = language ? `?language=${language}` : '';
      return http.request('GET', `/v1/courses${query}`, CourseListSchema);
    },
    get(sessionId: string): Promise<Course> {
      return http.request('GET', `/v1/courses/${sessionId}`, CourseSchema);
    },
    /** Adds the phrases of the course to the Phrase Bank (idempotent). */
    start(sessionId: string): Promise<StartCourseResponse> {
      return http.request('POST', `/v1/courses/${sessionId}/start`, StartCourseResponseSchema);
    },
    /** The next sitting as ordinary review cards; answer them with the review route. */
    queue(sessionId: string, options: { dictation?: boolean } = {}): Promise<ReviewQueue> {
      const query = options.dictation ? '?dictation=1' : '';
      return http.request('GET', `/v1/courses/${sessionId}/queue${query}`, ReviewQueueSchema);
    },
    /** Only meeting ids go up: calendar titles are matched on the device. */
    prep(input: PrepCourseRequest): Promise<PrepCourse> {
      return http.request('POST', '/v1/courses/prep', PrepCourseSchema, input);
    },
  };
}
