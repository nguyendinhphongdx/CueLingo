import { ErrorCode } from '@cuelingo/shared';
import type { FastifyInstance } from 'fastify';
import { AppError } from './errors';

declare module 'fastify' {
  interface FastifyRequest {
    /** Authenticated user. Set by the auth hook; never read a user id from body or params. */
    userId: string;
  }
}

export interface AuthOptions {
  /**
   * TEMPORARY until the auth module exists (docs/03-parts/api/auth.md):
   * trusts the `x-dev-user-id` header. Must stay false in production.
   */
  allowDevAuth: boolean;
}

export function registerAuth(app: FastifyInstance, options: AuthOptions): void {
  app.decorateRequest('userId', '');
  app.addHook('onRequest', async (request) => {
    if (request.url === '/healthz') return;
    const devUser = request.headers['x-dev-user-id'];
    if (options.allowDevAuth && typeof devUser === 'string' && devUser) {
      request.userId = devUser;
      return;
    }
    throw new AppError(ErrorCode.Unauthorized, 'Authentication required');
  });
}
