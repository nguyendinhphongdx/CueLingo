import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import Fastify, {
  type FastifyInstance,
  type FastifyPluginAsync,
  type FastifyServerOptions,
} from 'fastify';
import { registerAuth, type AuthOptions } from './lib/auth';
import { registerErrorHandler } from './lib/errors';
import type { JobQueue } from './lib/queue';
import { createAssistModule, type AssistDeps } from './modules/assist';
import { createTtsModule, type TtsDeps } from './modules/tts';
import { createDebriefModule, type DebriefRepository } from './modules/debrief';
import { createEventsModule, type EventsRepository } from './modules/events';
import { createDialModule, type DialRepository } from './modules/dial';
import { createPlacementModule, type PlacementRepository } from './modules/placement';
import { createAccountModule, type AccountRepository } from './modules/account';
import { createDeviceModule, type DeviceRepository } from './modules/device';
import { createFollowupModule, type FollowupDeps } from './modules/followup';
import { createConversationsModule, type ConversationsRepository } from './modules/conversations';
import { createGlossaryModule, type GlossaryRepository } from './modules/glossary';
import { createPrivacyModule, type PrivacyRepository } from './modules/privacy';
import { createRealtimeModule, type RealtimeDeps } from './modules/realtime';
import {
  createReviewModule,
  createStudyModule,
  type PhrasesRepository,
  type StudyRepository,
} from './modules/review';
import { createSpeakersModule, type SpeakersRepository } from './modules/speakers';
import { createSessionsModule, type SessionsRepository } from './modules/sessions';
import { createAdminModule, type AdminRepository } from './modules/admin';
import { createFeedbackModule, type FeedbackRepository } from './modules/feedback';
import { createInvitesModule, type InvitesRepository } from './modules/invites';
import { createTranscribeModule, type TranscribeDeps } from './modules/transcribe';
import { createSettingsModule, type SettingsRepository } from './modules/settings';

/** Origins of the desktop webview (bundled app, Windows bundle, `tauri dev`). It signs in with a bearer token, not cookies. */
const DESKTOP_ORIGINS = ['tauri://localhost', 'http://tauri.localhost', 'http://localhost:1420'];
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,64}$/;
const LOG_REDACT = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.body',
    'res.headers.set-cookie',
    'authorization',
    'body',
    'email',
    '*.email',
    '*.*.email',
  ],
  censor: '[Redacted]',
};

export interface AppDeps {
  repos: {
    debrief: DebriefRepository;
    events: EventsRepository;
    glossary: GlossaryRepository;
    conversations: ConversationsRepository;
    account: AccountRepository;
    dial: DialRepository;
    placement: PlacementRepository;
    device: DeviceRepository;
    phrases: PhrasesRepository;
    privacy: PrivacyRepository;
    study: StudyRepository;
    sessions: SessionsRepository;
    speakers: SpeakersRepository;
    admin: AdminRepository;
    invites: InvitesRepository;
    feedback: FeedbackRepository;
    settings: SettingsRepository;
  };
  queue: JobQueue;
  resolveUserId: AuthOptions['resolveUserId'];
  /** Origin of apps/web, allowed by CORS (cookies included). */
  webOrigin: string;
  /** Mounts /api/auth/*. Omitted in tests that fake the session. */
  authRoutes?: FastifyPluginAsync;
  /** Enables the live-caption WebSocket route when its provider credentials are available. */
  realtime?: RealtimeDeps;
  /** Enables Quick Assist routes when an AI gateway is available. */
  assist?: AssistDeps;
  /** Enables text to speech when an AI gateway and an audio cache are available. */
  tts?: TtsDeps;
  /** Enables cloud speech recognition for meetings in cloud-recognised languages (ADR 0014). */
  transcribe?: TranscribeDeps;
  /** Enables follow-up drafts from a debrief when an AI gateway is available. */
  followup?: FollowupDeps;
  /** Development-only bearer-token verifier for assist and event ingestion. */
  verifyDevToken?: AuthOptions['verifyDevToken'];
  /** False disables logs. Object form is mainly a test seam for an in-memory stream. */
  logger?: FastifyServerOptions['logger'];
  adminEmails?: readonly string[];
  /** Adds `Secure` to the invite cookie. True in production. */
  secureCookies?: boolean;
}

/** Composition root: the only place that wires repositories, services and routes together. */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const requestedLogger = deps.logger ?? false;
  const logger =
    requestedLogger && typeof requestedLogger === 'object'
      ? { ...requestedLogger, redact: LOG_REDACT }
      : requestedLogger
        ? { redact: LOG_REDACT }
        : false;
  const app = Fastify({
    logger,
    // Not `requestIdHeader`: Fastify would take the client's value as is. `genReqId` checks it first.
    requestIdHeader: false,
    genReqId: (request) => {
      const candidate = request.headers['x-request-id'];
      return typeof candidate === 'string' && SAFE_REQUEST_ID.test(candidate)
        ? candidate
        : randomUUID();
    },
  });
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });
  if (deps.realtime) await app.register(websocket);
  registerErrorHandler(app);
  // CORS first, so preflight requests are answered before the auth hook runs.
  // @fastify/cors only allows GET, HEAD and POST by default; the glossary needs PATCH and DELETE from the browser.
  await app.register(cors, {
    // The desktop app's webview has its own origin: tauri://localhost when bundled, the Vite dev server otherwise.
    origin: [deps.webOrigin, ...DESKTOP_ORIGINS],
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'],
  });
  const device = createDeviceModule(deps.repos.device);
  registerAuth(app, {
    resolveUserId: deps.resolveUserId,
    verifyDevToken: deps.verifyDevToken,
    verifyDeviceToken: device.device.verifyToken,
  });

  await app.register(device.routes, { prefix: '/v1/device' });
  await app.register(createAccountModule(deps.repos.account).routes);
  await app.register(createDialModule(deps.repos.dial).routes);
  await app.register(createPlacementModule(deps.repos.placement).routes);
  const admin = createAdminModule(deps.repos.admin, deps.adminEmails ?? []);
  await app.register(admin.routes, { prefix: '/v1/admin' });
  await app.register(
    createInvitesModule(deps.repos.invites, admin.service.isAdmin, {
      secureCookie: deps.secureCookies ?? false,
    }).routes,
  );
  app.get('/healthz', async () => ({ ok: true }));
  if (deps.authRoutes) await app.register(deps.authRoutes);
  await app.register(createDebriefModule(deps.repos.debrief).routes);
  await app.register(createEventsModule(deps.repos.events).routes, { prefix: '/v1/events' });
  await app.register(createFeedbackModule(deps.repos.feedback).routes);
  await app.register(createConversationsModule(deps.repos.conversations).routes, {
    prefix: '/v1/conversations',
  });
  await app.register(createGlossaryModule(deps.repos.glossary).routes, { prefix: '/v1/glossary' });
  await app.register(createPrivacyModule(deps.repos.privacy).routes);
  await app.register(createSettingsModule(deps.repos.settings).routes);
  await app.register(createSessionsModule(deps.repos.sessions, deps.queue).routes, {
    prefix: '/v1/sessions',
  });
  await app.register(createSpeakersModule(deps.repos.speakers).routes);
  await app.register(createReviewModule(deps.repos.phrases).routes, { prefix: '/v1/phrases' });
  const study = createStudyModule(deps.repos.study);
  await app.register(study.reviewRoutes, { prefix: '/v1/review' });
  await app.register(study.progressRoutes, { prefix: '/v1/progress' });
  if (deps.transcribe) {
    await app.register(createTranscribeModule(deps.repos.sessions, deps.transcribe).routes);
  }
  if (deps.followup) {
    await app.register(
      createFollowupModule(deps.repos.sessions, deps.repos.debrief, deps.followup).routes,
    );
  }
  if (deps.tts) await app.register(createTtsModule(deps.tts).routes, { prefix: '/v1/tts' });
  if (deps.assist) {
    await app.register(createAssistModule(deps.assist).routes, { prefix: '/v1/assist' });
  }
  if (deps.realtime) await app.register(createRealtimeModule(deps.realtime).routes);

  return app;
}
