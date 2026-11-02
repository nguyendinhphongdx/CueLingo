import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import type { AiGateway } from '@cuelingo/ai-gateway';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from './testing';

const WEB = 'http://localhost:3000';

describe('request observability', () => {
  const apps: FastifyInstance[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('keeps a safe client request id and replaces an unsafe one', async () => {
    const app = await buildTestApp();
    apps.push(app);
    const kept = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { 'x-request-id': 'desktop:meeting_42' },
    });
    expect(kept.headers['x-request-id']).toBe('desktop:meeting_42');

    const replaced = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { 'x-request-id': 'bad id with spaces' },
    });
    expect(replaced.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(replaced.headers['x-request-id']).not.toBe('bad id with spaces');
  });

  it('returns the request id in error bodies', async () => {
    const app = await buildTestApp();
    apps.push(app);
    const response = await app.inject({
      method: 'GET',
      url: '/v1/glossary',
      headers: { 'x-request-id': 'web.safe-7' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.requestId).toBe('web.safe-7');
  });

  it('never writes authorization, request bodies, or email values to request logs', async () => {
    let logs = '';
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logs += chunk.toString();
        callback();
      },
    });
    const app = await buildTestApp({ logger: { level: 'info', stream } });
    apps.push(app);
    await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: {
        authorization: 'Bearer super-secret-token',
        'x-test-user-id': 'user@example.com',
      },
      payload: { email: 'private@example.com', transcript: 'confidential meeting words' },
    });
    expect(logs).not.toContain('super-secret-token');
    expect(logs).not.toContain('private@example.com');
    expect(logs).not.toContain('confidential meeting words');
  });
});

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

describe('local development bearer token', () => {
  const DEV_TOKEN = 'local-development-token';
  const DEV_USER = 'local-user';
  let app: FastifyInstance;

  beforeEach(async () => {
    const json = (async () => ({
      term: 'table',
      meaningVi: 'hoãn',
      exampleEn: 'Let us table this topic.',
    })) as AiGateway['json'];
    app = await buildTestApp({
      assist: { gateway: { json } },
      resolveUserId: async () => null,
      verifyDevToken: async (token) => (token === DEV_TOKEN ? DEV_USER : null),
    });
  });
  afterEach(() => app.close());

  it('accepts the realtime development token for assist routes', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/assist/lookup',
      headers: { authorization: `Bearer ${DEV_TOKEN}` },
      payload: { term: 'table' },
    });
    expect(response.statusCode).toBe(200);
  });

  it('accepts the token at the events and privacy auth boundaries but nowhere else', async () => {
    const events = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { authorization: `Bearer ${DEV_TOKEN}` },
      payload: {},
    });
    expect(events.statusCode).toBe(400);

    const privacy = await app.inject({
      method: 'GET',
      url: '/v1/me/export',
      headers: { authorization: `Bearer ${DEV_TOKEN}` },
    });
    expect(privacy.statusCode).toBe(200);

    const glossary = await app.inject({
      method: 'GET',
      url: '/v1/glossary',
      headers: { authorization: `Bearer ${DEV_TOKEN}` },
    });
    expect(glossary.statusCode).toBe(401);
  });

  it('rejects a bad development token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/assist/lookup',
      headers: { authorization: 'Bearer bad-token' },
      payload: { term: 'table' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('answers preflight requests from the desktop webview origin', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/sessions',
      headers: {
        origin: 'tauri://localhost',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type',
      },
    });
    expect(response.headers['access-control-allow-origin']).toBe('tauri://localhost');
  });
});
