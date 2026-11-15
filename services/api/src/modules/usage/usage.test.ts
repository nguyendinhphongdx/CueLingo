import { periodStart } from '@cuelingo/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryAdminRepository } from '../admin';
import { createInMemoryUsageRepository } from './index';

const ALICE = 'alice';
const BOB = 'bob';
const OWNER = 'owner';
const EMAILS = {
  [ALICE]: 'alice@example.com',
  [BOB]: 'bob@example.com',
  [OWNER]: 'owner@example.com',
};

const as = (user: string) => ({ [TEST_USER_HEADER]: user });

describe('usage module', () => {
  let app: FastifyInstance;
  afterEach(() => app.close());

  async function build(options: Parameters<typeof buildTestApp>[0] = {}) {
    app = await buildTestApp({
      adminEmails: ['owner@example.com'],
      ...options,
      repos: {
        admin: createInMemoryAdminRepository(EMAILS),
        usage: createInMemoryUsageRepository(EMAILS),
        ...options.repos,
      },
    });
    return app;
  }

  const getUsage = (user: string) =>
    app.inject({ method: 'GET', url: '/v1/me/usage', headers: as(user) });

  it('returns own usage with all five allowances (AC3)', async () => {
    await build();
    const res = await getUsage(ALICE);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.plan).toBe('free');
    expect(Object.keys(body.usage).sort()).toEqual(
      ['agent_messages', 'assist_daily', 'cloud_stt_ms', 'debriefs', 'translation_ms'].sort(),
    );
    expect(body.usage.translation_ms).toMatchObject({ used: 0, limit: 7_200_000, state: 'ok' });
    expect(body.usage.debriefs.limit).toBe(8);
    // Vietnam month and day boundaries are 17:00 UTC.
    expect(body.usage.debriefs.resetsAt).toMatch(/T17:00:00\.000Z$/);
    expect(body.usage.assist_daily.resetsAt).toMatch(/T17:00:00\.000Z$/);
  });

  it('requires a signed-in user', async () => {
    await build();
    const res = await app.inject({ method: 'GET', url: '/v1/me/usage' });
    expect(res.statusCode).toBe(401);
  });

  it('never shows one user the usage of another (user boundary)', async () => {
    const repo = createInMemoryUsageRepository(EMAILS);
    await build({ repos: { usage: repo } });
    // Reserve through the service path Alice's own request would use, then read as Bob.
    await repo.add(ALICE, 'debriefs', periodStart('debriefs', new Date()), 3);
    expect((await getUsage(ALICE)).json().usage.debriefs.used).toBe(3);
    expect((await getUsage(BOB)).json().usage.debriefs.used).toBe(0);
  });

  it('has no limit for an admin but still counts (AC12)', async () => {
    await build();
    const res = (await getUsage(OWNER)).json();
    expect(res.usage.translation_ms.limit).toBeNull();
    expect(res.usage.debriefs.limit).toBeNull();
    expect(res.usage.agent_messages.limit).toBeNull();
  });
});
