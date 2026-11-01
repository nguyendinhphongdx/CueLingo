import { ErrorCode } from '@cuelingo/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError } from './errors';

declare module 'fastify' {
  interface FastifyRequest {
    /** Authenticated user. Set by the auth hook; never read a user id from body or params. */
    userId: string;
  }
}

export interface AuthOptions {
  /** Turns a request into the signed-in user's id, or null. Production: Better Auth session. Tests: a header. */
  resolveUserId: (request: FastifyRequest) => Promise<string | null>;
}

const isPublic = (url: string) => url === '/healthz' || url.startsWith('/api/auth/');

export function registerAuth(app: FastifyInstance, options: AuthOptions): void {
  app.decorateRequest('userId', '');
  app.addHook('onRequest', async (request) => {
    if (isPublic(request.url)) return;
    const userId = await options.resolveUserId(request);
    if (!userId) throw new AppError(ErrorCode.Unauthorized, 'Authentication required');
    request.userId = userId;
  });
}
