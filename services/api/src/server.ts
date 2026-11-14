import { createAiGateway } from '@cuelingo/ai-gateway';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import { loadConfig } from './config';
import { createSql } from './lib/db';
import { createPgBossQueue } from './lib/queue';
import { createAiCallHook } from './lib/ai-calls';
import { createAuthModule } from './modules/auth';
import { createPostgresDebriefRepository } from './modules/debrief';
import { createPostgresEventsRepository } from './modules/events';
import { createPostgresAgentRepository } from './modules/agent';
import { createPostgresConversationsRepository } from './modules/conversations';
import { createPostgresGlossaryRepository } from './modules/glossary';
import { createPostgresSpeakersRepository } from './modules/speakers';
import { createPostgresPrivacyRepository } from './modules/privacy';
import { createPostgresSessionsRepository } from './modules/sessions';
import { createPostgresSettingsRepository } from './modules/settings';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFileTtsCache } from './modules/tts';
import { createPostgresDialRepository } from './modules/dial';
import { createPostgresPlacementRepository } from './modules/placement';
import { createPostgresAccountRepository } from './modules/account';
import { createDeviceService, createPostgresDeviceRepository } from './modules/device';
import { createPostgresPhrasesRepository, createPostgresStudyRepository } from './modules/review';
import { createPostgresAdminRepository } from './modules/admin';
import { createPostgresFeedbackRepository } from './modules/feedback';
import { createInviteGate, createPostgresInvitesRepository } from './modules/invites';
import type { LanguageCode } from '@cuelingo/shared';

const config = loadConfig();

const sql = createSql(config.DATABASE_URL);
const queue = await createPgBossQueue(config.DATABASE_URL);
const invitesRepository = createPostgresInvitesRepository(sql);
const authModule = createAuthModule(
  config,
  undefined,
  createInviteGate(invitesRepository, config.INVITES_REQUIRED),
);
const debriefRepository = createPostgresDebriefRepository(sql);
const eventsRepository = createPostgresEventsRepository(sql);
const glossaryRepository = createPostgresGlossaryRepository(sql);
const conversationsRepository = createPostgresConversationsRepository(sql);
const privacyRepository = createPostgresPrivacyRepository(sql);
const sessionsRepository = createPostgresSessionsRepository(sql);
const phrasesRepository = createPostgresPhrasesRepository(sql);
const deviceRepository = createPostgresDeviceRepository(sql);
const deviceService = createDeviceService(deviceRepository);
const studyRepository = createPostgresStudyRepository(sql);
const adminRepository = createPostgresAdminRepository(sql);
// The AI hook is created before the app exists, so it reaches the logger through this holder.
const appRef: { current?: FastifyInstance } = {};

const gateway = config.GEMINI_API_KEY
  ? createAiGateway({
      googleApiKey: config.GEMINI_API_KEY,
      agentHtmlBlocks: config.AGENT_HTML_BLOCKS,
      onCall: createAiCallHook(sql, (error, record) =>
        appRef.current?.log.error(
          { err: error, task: record.task, model: record.model },
          'AI call metrics persistence failed',
        ),
      ),
    })
  : undefined;

async function verifyDevToken(token: string): Promise<string | null> {
  if (!config.REALTIME_DEV_TOKEN || token !== config.REALTIME_DEV_TOKEN) return null;
  if (config.REALTIME_DEV_USER_ID) return config.REALTIME_DEV_USER_ID;
  const [profile] = await sql<{ user_id: string }[]>`
    SELECT user_id FROM learner_profiles ORDER BY created_at LIMIT 1`;
  return profile?.user_id ?? null;
}

const realtime = gateway
  ? {
      gateway,
      // The live-caption socket authenticates with either a device token (the signed-in app) or the dev token.
      verifyToken: async (token: string) =>
        (await deviceService.verifyToken(token)) ??
        (config.NODE_ENV === 'production' ? null : await verifyDevToken(token)),
      async glossary(userId: string, language: LanguageCode) {
        return (await glossaryRepository.list(userId, language))
          .slice(0, 50)
          .map(({ term, translation }) => ({ term, translation }));
      },
      store: sessionsRepository,
    }
  : undefined;

const app = await buildApp({
  repos: {
    debrief: debriefRepository,
    events: eventsRepository,
    glossary: glossaryRepository,
    conversations: conversationsRepository,
    agent: createPostgresAgentRepository(sql),
    privacy: privacyRepository,
    sessions: sessionsRepository,
    speakers: createPostgresSpeakersRepository(sql),
    settings: createPostgresSettingsRepository(sql),
    account: createPostgresAccountRepository(sql),
    dial: createPostgresDialRepository(sql),
    placement: createPostgresPlacementRepository(sql),
    device: deviceRepository,
    phrases: phrasesRepository,
    study: studyRepository,
    admin: adminRepository,
    invites: invitesRepository,
    feedback: createPostgresFeedbackRepository(sql),
  },
  queue,
  resolveUserId: authModule.resolveUserId,
  authRoutes: authModule.routes,
  webOrigin: config.WEB_ORIGIN,
  realtime,
  assist: gateway ? { gateway } : undefined,
  agent: {
    enabled: config.AGENT_ENABLED && Boolean(gateway),
    gateway,
    htmlBlocks: config.AGENT_HTML_BLOCKS,
    quota: {
      turns: config.AGENT_QUOTA_TURNS_PER_DAY,
      tokens: config.AGENT_QUOTA_TOKENS_PER_DAY,
      costUsd: config.AGENT_QUOTA_USD_PER_DAY,
    },
  },
  transcribe: gateway ? { gateway } : undefined,
  followup: gateway ? { gateway } : undefined,
  tts: gateway
    ? { gateway, cache: createFileTtsCache(config.TTS_CACHE_DIR ?? join(tmpdir(), 'cuelingo-tts')) }
    : undefined,
  verifyDevToken: config.NODE_ENV === 'production' ? undefined : verifyDevToken,
  logger: true,
  adminEmails: config.ADMIN_EMAILS,
  secureCookies: config.NODE_ENV === 'production',
  invitesRequired: config.INVITES_REQUIRED,
});

appRef.current = app;
if (!gateway) app.log.warn('Realtime and Quick Assist disabled because GEMINI_API_KEY is not set');

// Ctrl+C reaches the process as SIGINT and again as SIGTERM from the package manager: close everything once.
let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await app.close();
  await queue.stop();
  await authModule.close();
  await sql.end();
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ port: config.PORT, host: '0.0.0.0' });
