import {
  CreateInviteRequestSchema,
  ErrorCode,
  INVITE_COOKIE,
  InviteIntentRequestSchema,
  type CreatedInvite,
  type InviteList,
} from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { AppError } from '../../lib/errors';
import { IdParamsSchema, parse } from '../../lib/http';
import { INVITE_REFUSED, type InvitesService } from './invites.service';

const COOKIE_SECONDS = 30 * 60;
const INTENT_LIMIT = 10;
const INTENT_WINDOW_MS = 10 * 60 * 1000;

/** Counts attempts per address in memory: enough for a closed beta on one API process. */
function createAttemptLimiter(limit: number, windowMs: number, now: () => number) {
  const hits = new Map<string, number[]>();
  return (key: string): boolean => {
    const recent = (hits.get(key) ?? []).filter((at) => now() - at < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    hits.set(key, [...recent, now()]);
    return true;
  };
}

export interface InviteRouteOptions {
  /** Add `Secure` to the cookie (production). */
  secureCookie: boolean;
  now?: () => number;
}

export function invitesRoutes(
  service: InvitesService,
  options: InviteRouteOptions,
): FastifyPluginAsync {
  return async (app) => {
    const allow = createAttemptLimiter(INTENT_LIMIT, INTENT_WINDOW_MS, options.now ?? Date.now);

    // Public: the login page sends the typed code here before it starts a sign-in.
    app.post('/v1/invites/intent', async (request, reply) => {
      if (!allow(request.ip)) throw new AppError(ErrorCode.RateLimited, 'Too many attempts');
      const body = InviteIntentRequestSchema.safeParse(request.body);
      const code = body.success ? await service.check(body.data.code) : null;
      if (!code) throw new AppError(ErrorCode.InviteInvalid, INVITE_REFUSED);
      reply.header(
        'set-cookie',
        `${INVITE_COOKIE}=${code}; Max-Age=${COOKIE_SECONDS}; Path=/; HttpOnly; SameSite=Lax${
          options.secureCookie ? '; Secure' : ''
        }`,
      );
      return reply.code(204).send();
    });

    app.post('/v1/admin/invites', async (request, reply): Promise<CreatedInvite> => {
      const input = parse(CreateInviteRequestSchema, request.body ?? {});
      reply.code(201);
      return service.create(request.userId, input);
    });

    app.get('/v1/admin/invites', async (request): Promise<InviteList> => {
      return { items: await service.list(request.userId) };
    });

    app.delete('/v1/admin/invites/:id', async (request, reply) => {
      const { id } = parse(IdParamsSchema, request.params);
      await service.revoke(request.userId, id);
      return reply.code(204).send();
    });
  };
}
