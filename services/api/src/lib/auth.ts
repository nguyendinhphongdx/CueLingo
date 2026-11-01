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
  /** Optional local-development token verifier. Production composition omits it. */
  verifyDevToken?: (token: string) => Promise<string | null>;
}

const isPublic = (url: string) =>
  url === '/healthz' ||
  url.startsWith('/api/auth/') ||
  /^\/v1\/sessions\/[^/]+\/stream(?:\?|$)/.test(url);

const acceptsDevToken = (url: string) =>
  /^\/v1\/(?:assist|events|sessions|phrases|review|progress|me)(?:\/|\?|$)/.test(url);

const bearerToken = (request: FastifyRequest): string | null => {
  const header = request.headers.authorization;
  const match = typeof header === 'string' ? /^Bearer\s+(.+)$/.exec(header) : null;
  return match?.[1] ?? null;
};

export function registerAuth(app: FastifyInstance, options: AuthOptions): void {
  app.decorateRequest('userId', '');
  app.addHook('onRequest', async (request) => {
    if (isPublic(request.url)) return;
    const token = acceptsDevToken(request.url) ? bearerToken(request) : null;
    if (token && options.verifyDevToken) {
      const devUserId = await options.verifyDevToken(token);
      if (devUserId) {
        request.userId = devUserId;
        return;
      }
    }
    const userId = await options.resolveUserId(request);
    if (!userId) throw new AppError(ErrorCode.Unauthorized, 'Authentication required');
    request.userId = userId;
  });
}
