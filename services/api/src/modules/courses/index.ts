/**
 * Courses module — learning path computed from a meeting's debrief and the user's review history.
 * Design: apps/docs/docs/04-modules/03-api/courses.md · Pattern: modules/glossary
 */
import { coursesRoutes } from './courses.routes';
import { createCoursesService, type CoursesPorts } from './courses.service';
import type { CoursesRepository } from './courses.repository';

export function createCoursesModule(repo: CoursesRepository, ports: CoursesPorts) {
  const service = createCoursesService(repo, ports);
  return { service, routes: coursesRoutes(service) };
}

export type { CoursesRepository } from './courses.repository';
export type { CoursesService } from './courses.service';
export { createPostgresCoursesRepository } from './courses.repository';
export type { InMemoryCoursesRepository } from './courses.repository.memory';
export { createInMemoryCoursesRepository } from './courses.repository.memory';
