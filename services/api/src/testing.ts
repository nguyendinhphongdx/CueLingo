import type { FastifyInstance } from 'fastify';
import { buildApp, type AppDeps } from './app';
import { createInMemoryQueue } from './lib/queue';
import { createInMemoryEventsRepository } from './modules/events';
import { createInMemoryGlossaryRepository } from './modules/glossary';

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
      events: createInMemoryEventsRepository(),
      glossary: createInMemoryGlossaryRepository(),
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
