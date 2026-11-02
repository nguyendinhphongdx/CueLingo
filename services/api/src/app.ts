import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify';
import { registerAuth, type AuthOptions } from './lib/auth';
import { registerErrorHandler } from './lib/errors';
import type { JobQueue } from './lib/queue';
import { createAssistModule, type AssistDeps } from './modules/assist';
import { createDebriefModule, type DebriefRepository } from './modules/debrief';
import { createEventsModule, type EventsRepository } from './modules/events';
import { createAccountModule, type AccountRepository } from './modules/account';
import { createDeviceModule, type DeviceRepository } from './modules/device';
import { createGlossaryModule, type GlossaryRepository } from './modules/glossary';
import { createPrivacyModule, type PrivacyRepository } from './modules/privacy';
import { createRealtimeModule, type RealtimeDeps } from './modules/realtime';
import {
  createReviewModule,
  createStudyModule,
  type PhrasesRepository,
  type StudyRepository,
} from './modules/review';
import { createSessionsModule, type SessionsRepository } from './modules/sessions';

/** Origins of the desktop webview (bundled app, Windows bundle, `tauri dev`). It signs in with a bearer token, not cookies. */
const DESKTOP_ORIGINS = ['tauri://localhost', 'http://tauri.localhost', 'http://localhost:1420'];

export interface AppDeps {
  repos: {
    debrief: DebriefRepository;
    events: EventsRepository;
    glossary: GlossaryRepository;
    account: AccountRepository;
    device: DeviceRepository;
    phrases: PhrasesRepository;
    privacy: PrivacyRepository;
    study: StudyRepository;
    sessions: SessionsRepository;
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
  /** Development-only bearer-token verifier for assist and event ingestion. */
  verifyDevToken?: AuthOptions['verifyDevToken'];
  logger?: boolean;
}

/** Composition root: the only place that wires repositories, services and routes together. */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.logger ?? false });
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
  app.get('/healthz', async () => ({ ok: true }));
  if (deps.authRoutes) await app.register(deps.authRoutes);
  await app.register(createDebriefModule(deps.repos.debrief).routes);
  await app.register(createEventsModule(deps.repos.events).routes, { prefix: '/v1/events' });
  await app.register(createGlossaryModule(deps.repos.glossary).routes, { prefix: '/v1/glossary' });
  await app.register(createPrivacyModule(deps.repos.privacy).routes);
  await app.register(createSessionsModule(deps.repos.sessions, deps.queue).routes, {
    prefix: '/v1/sessions',
  });
  await app.register(createReviewModule(deps.repos.phrases).routes, { prefix: '/v1/phrases' });
  const study = createStudyModule(deps.repos.study);
  await app.register(study.reviewRoutes, { prefix: '/v1/review' });
  await app.register(study.progressRoutes, { prefix: '/v1/progress' });
  if (deps.assist) {
    await app.register(createAssistModule(deps.assist).routes, { prefix: '/v1/assist' });
  }
  if (deps.realtime) await app.register(createRealtimeModule(deps.realtime).routes);

  return app;
}
