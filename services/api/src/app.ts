import cors from '@fastify/cors';
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify';
import { registerAuth, type AuthOptions } from './lib/auth';
import { registerErrorHandler } from './lib/errors';
import type { JobQueue } from './lib/queue';
import { createGlossaryModule, type GlossaryRepository } from './modules/glossary';

export interface AppDeps {
  repos: { glossary: GlossaryRepository };
  queue: JobQueue;
  resolveUserId: AuthOptions['resolveUserId'];
  /** Origin of apps/web, allowed by CORS (cookies included). */
  webOrigin: string;
  /** Mounts /api/auth/*. Omitted in tests that fake the session. */
  authRoutes?: FastifyPluginAsync;
  logger?: boolean;
}

/** Composition root: the only place that wires repositories, services and routes together. */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.logger ?? false });
  registerErrorHandler(app);
  // CORS first, so preflight requests are answered before the auth hook runs.
  await app.register(cors, { origin: deps.webOrigin, credentials: true });
  registerAuth(app, { resolveUserId: deps.resolveUserId });

  app.get('/healthz', async () => ({ ok: true }));
  if (deps.authRoutes) await app.register(deps.authRoutes);
  await app.register(createGlossaryModule(deps.repos.glossary).routes, { prefix: '/v1/glossary' });

  return app;
}
