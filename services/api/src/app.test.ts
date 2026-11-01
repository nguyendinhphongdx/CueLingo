import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from './testing';

const WEB = 'http://localhost:3000';

describe('CORS for the web app', () => {
  let app: FastifyInstance;
  beforeEach(async () => {
    app = await buildTestApp({ webOrigin: WEB });
  });
  afterEach(() => app.close());

  const preflight = (method: string, origin = WEB) =>
    app.inject({
      method: 'OPTIONS',
      url: '/v1/glossary/6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f',
      headers: { origin, 'access-control-request-method': method },
    });

  // Found by running the web app in a browser: DELETE failed with ERR_FAILED because the preflight did not allow it.
  it.each(['GET', 'POST', 'PATCH', 'DELETE'])(
    'allows %s from the web origin, with cookies',
    async (method) => {
      const res = await preflight(method);
      expect(res.statusCode).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(WEB);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(String(res.headers['access-control-allow-methods'])).toContain(method);
    },
  );

  it('does not grant access to another origin', async () => {
    const res = await preflight('DELETE', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.example');
  });
});
