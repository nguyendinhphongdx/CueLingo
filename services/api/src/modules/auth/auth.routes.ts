import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { Auth } from './auth';

/** Mounts Better Auth's handler under /api/auth/* (Fastify request -> Fetch Request -> reply). */
export function authRoutes(auth: Auth): FastifyPluginAsync {
  return async (app) => {
    app.route({
      method: ['GET', 'POST'],
      url: '/api/auth/*',
      handler: async (request, reply) => {
        const url = new URL(request.url, `http://${request.headers.host}`);
        const body = request.body === undefined ? undefined : JSON.stringify(request.body);
        const response = await auth.handler(
          new Request(url, {
            method: request.method,
            headers: fromNodeHeaders(request.headers),
            body,
          }),
        );

        reply.status(response.status);
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() !== 'set-cookie') reply.header(key, value);
        });
        // Set-Cookie can repeat; forEach would fold them into one header.
        const cookies = response.headers.getSetCookie();
        if (cookies.length > 0) reply.header('set-cookie', cookies);

        return reply.send(response.body ? await response.text() : null);
      },
    });
  };
}

/** The user id behind a request's session cookie, or null when signed out. */
export function sessionUserId(auth: Auth) {
  return async (request: FastifyRequest): Promise<string | null> => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    return session?.user.id ?? null;
  };
}
