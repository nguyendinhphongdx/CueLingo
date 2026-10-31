import Fastify, { type FastifyInstance } from 'fastify';
import { registerAuth } from './lib/auth';
import { registerErrorHandler } from './lib/errors';
import { createGlossaryModule, type GlossaryRepository } from './modules/glossary';

export interface AppDeps {
  repos: { glossary: GlossaryRepository };
  allowDevAuth?: boolean;
  logger?: boolean;
}

/** Composition root: the only place that wires repositories, services and routes together. */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.logger ?? false });
  registerErrorHandler(app);
  registerAuth(app, { allowDevAuth: deps.allowDevAuth ?? false });

  app.get('/healthz', async () => ({ ok: true }));
  await app.register(createGlossaryModule(deps.repos.glossary).routes, { prefix: '/v1/glossary' });

  return app;
}
