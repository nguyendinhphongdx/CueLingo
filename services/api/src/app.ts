import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify';
import { registerAuth, type AuthOptions } from './lib/auth';
import { registerErrorHandler } from './lib/errors';
import type { JobQueue } from './lib/queue';
import { createAssistModule, type AssistDeps } from './modules/assist';
import { createEventsModule, type EventsRepository } from './modules/events';
import { createGlossaryModule, type GlossaryRepository } from './modules/glossary';
import { createRealtimeModule, type RealtimeDeps } from './modules/realtime';
import { createReviewModule, type PhrasesRepository } from './modules/review';

export interface AppDeps {
  repos: {
    events: EventsRepository;
    glossary: GlossaryRepository;
    phrases: PhrasesRepository;
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
    origin: deps.webOrigin,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'],
  });
  registerAuth(app, { resolveUserId: deps.resolveUserId, verifyDevToken: deps.verifyDevToken });

  app.get('/healthz', async () => ({ ok: true }));
  if (deps.authRoutes) await app.register(deps.authRoutes);
  await app.register(createEventsModule(deps.repos.events).routes, { prefix: '/v1/events' });
  await app.register(createGlossaryModule(deps.repos.glossary).routes, { prefix: '/v1/glossary' });
  await app.register(createReviewModule(deps.repos.phrases).routes, { prefix: '/v1/phrases' });
  if (deps.assist) {
    await app.register(createAssistModule(deps.assist).routes, { prefix: '/v1/assist' });
  }
  if (deps.realtime) await app.register(createRealtimeModule(deps.realtime).routes);

  return app;
}
