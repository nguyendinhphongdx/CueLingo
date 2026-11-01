import type { FastifyInstance } from 'fastify';
import { buildApp, type AppDeps } from './app';
import { createInMemoryQueue } from './lib/queue';
import { createInMemoryDebriefRepository } from './modules/debrief';
import { createInMemoryEventsRepository } from './modules/events';
import { createInMemoryGlossaryRepository } from './modules/glossary';
import { createInMemorySessionsRepository } from './modules/sessions';
import { createInMemoryPhrasesRepository, createInMemoryStudyRepository } from './modules/review';

/** Header the test resolver reads in place of a real session. */
export const TEST_USER_HEADER = 'x-test-user-id';

/** App wired with in-memory repositories, an in-memory queue and a header-based session. */
export async function buildTestApp(
  overrides: Partial<Omit<AppDeps, 'repos'>> & { repos?: Partial<AppDeps['repos']> } = {},
): Promise<FastifyInstance & { queue: ReturnType<typeof createInMemoryQueue> }> {
  const queue = createInMemoryQueue();
  const { repos, ...appOverrides } = overrides;
  const app = await buildApp({
    repos: {
      debrief: createInMemoryDebriefRepository(),
      events: createInMemoryEventsRepository(),
      glossary: createInMemoryGlossaryRepository(),
      sessions: createInMemorySessionsRepository(),
      phrases: createInMemoryPhrasesRepository(),
      study: createInMemoryStudyRepository(),
      ...repos,
    },
    queue,
    resolveUserId: async (request) => {
      const value = request.headers[TEST_USER_HEADER];
      return typeof value === 'string' && value ? value : null;
    },
    webOrigin: 'http://localhost:3000',
    ...appOverrides,
  });
  return Object.assign(app, { queue });
}
