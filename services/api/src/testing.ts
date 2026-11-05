import type { FastifyInstance } from 'fastify';
import { buildApp, type AppDeps } from './app';
import { createInMemoryQueue } from './lib/queue';
import { createInMemoryDebriefRepository } from './modules/debrief';
import { createInMemoryEventsRepository } from './modules/events';
import { createInMemoryGlossaryRepository } from './modules/glossary';
import type { PrivacyRepository } from './modules/privacy';
import { createInMemorySessionsRepository } from './modules/sessions';
import { createInMemorySpeakersRepository } from './modules/speakers';
import { createInMemorySettingsRepository } from './modules/settings';
import { createInMemoryDialRepository } from './modules/dial';
import { createInMemoryPlacementRepository } from './modules/placement';
import { createInMemoryAccountRepository } from './modules/account';
import { createInMemoryDeviceRepository } from './modules/device';
import { createInMemoryPhrasesRepository, createInMemoryStudyRepository } from './modules/review';
import { createInMemoryAdminRepository } from './modules/admin';
import { createInMemoryInvitesRepository } from './modules/invites';

/** Header the test resolver reads in place of a real session. */
export const TEST_USER_HEADER = 'x-test-user-id';

const emptyPrivacyRepository = (): PrivacyRepository => ({
  async deleteMyData() {},
  async exportMyData(_userId, exportedAt) {
    return { exportedAt: exportedAt.toISOString(), sessions: [], phrases: [], glossaryTerms: [] };
  },
});

const emptySettingsRepository = () => createInMemorySettingsRepository();

/** App wired with in-memory repositories, an in-memory queue and a header-based session. */
export async function buildTestApp(
  overrides: Partial<Omit<AppDeps, 'repos'>> & { repos?: Partial<AppDeps['repos']> } = {},
): Promise<FastifyInstance & { queue: ReturnType<typeof createInMemoryQueue> }> {
  const queue = createInMemoryQueue();
  const { repos, ...appOverrides } = overrides;
  const sessions = repos?.sessions ?? createInMemorySessionsRepository();
  const app = await buildApp({
    repos: {
      debrief: createInMemoryDebriefRepository(),
      events: createInMemoryEventsRepository(),
      glossary: createInMemoryGlossaryRepository(),
      privacy: emptyPrivacyRepository(),
      sessions,
      // Shares the speaker rows of the in-memory sessions store, so a rename shows up in the transcript.
      speakers: createInMemorySpeakersRepository(
        'speakerRows' in sessions
          ? (sessions as ReturnType<typeof createInMemorySessionsRepository>)
          : createInMemorySessionsRepository(),
      ),
      settings: emptySettingsRepository(),
      account: createInMemoryAccountRepository(),
      dial: createInMemoryDialRepository(),
      placement: createInMemoryPlacementRepository(),
      device: createInMemoryDeviceRepository(),
      phrases: createInMemoryPhrasesRepository(),
      study: createInMemoryStudyRepository(),
      admin: createInMemoryAdminRepository(),
      invites: createInMemoryInvitesRepository(),
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
