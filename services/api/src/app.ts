import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify';
import { registerAuth, type AuthOptions } from './lib/auth';
import { registerErrorHandler } from './lib/errors';
import type { JobQueue } from './lib/queue';
import { createGlossaryModule, type GlossaryRepository } from './modules/glossary';
import { createRealtimeModule, type RealtimeDeps } from './modules/realtime';

export interface AppDeps {
  repos: { glossary: GlossaryRepository };
  queue: JobQueue;
  resolveUserId: AuthOptions['resolveUserId'];
  /** Origin of apps/web, allowed by CORS (cookies included). */
  webOrigin: string;
  /** Mounts /api/auth/*. Omitted in tests that fake the session. */
  authRoutes?: FastifyPluginAsync;
  /** Enables the live-caption WebSocket route when its provider credentials are available. */
  realtime?: RealtimeDeps;
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
  registerAuth(app, { resolveUserId: deps.resolveUserId });

  app.get('/healthz', async () => ({ ok: true }));
  if (deps.authRoutes) await app.register(deps.authRoutes);
  await app.register(createGlossaryModule(deps.repos.glossary).routes, { prefix: '/v1/glossary' });
  if (deps.realtime) await app.register(createRealtimeModule(deps.realtime).routes);

  return app;
}
