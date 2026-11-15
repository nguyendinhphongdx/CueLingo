import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryAdminRepository } from '../admin';
import { createInMemoryUsageRepository, createUsageModule } from './index';

const ALICE = 'alice';
const OWNER = 'owner';
const EMAILS = { [ALICE]: 'alice@example.com', [OWNER]: 'owner@example.com' };
const as = (user: string) => ({ [TEST_USER_HEADER]: user });

describe('plans', () => {
  let app: FastifyInstance;
  afterEach(() => app.close());

  async function build() {
    app = await buildTestApp({
      adminEmails: ['owner@example.com'],
      repos: {
        admin: createInMemoryAdminRepository(EMAILS),
        usage: createInMemoryUsageRepository(EMAILS),
      },
    });
  }
  const setPlan = (user: string, payload: unknown) =>
    app.inject({
      method: 'PUT',
      url: '/v1/admin/plan',
      headers: as(user),
      payload: payload as object,
    });
  const plan = async (user: string) =>
    (await app.inject({ method: 'GET', url: '/v1/me/usage', headers: as(user) })).json();

  it('gives a user with no plan row the free plan (AC1)', async () => {
    await build();
    expect((await plan(ALICE)).plan).toBe('free');
  });

  it('lets an admin change the plan, effective on the next check (AC2)', async () => {
    await build();
    const res = await setPlan(OWNER, { email: 'alice@example.com', plan: 'pro' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ email: 'alice@example.com', plan: 'pro' });
    const after = await plan(ALICE);
    expect(after.plan).toBe('pro');
    expect(after.usage.translation_ms.limit).toBe(72_000_000);
    expect(after.usage.debriefs.limit).toBeNull();
  });

  it('answers 403 to a caller who is not an admin', async () => {
    await build();
    const res = await setPlan(ALICE, { email: 'alice@example.com', plan: 'ultra' });
    expect(res.statusCode).toBe(403);
    expect((await plan(ALICE)).plan).toBe('free');
  });

  it('answers 404 for an unknown email and 400 for a bad plan', async () => {
    await build();
    expect((await setPlan(OWNER, { email: 'nobody@example.com', plan: 'pro' })).statusCode).toBe(
      404,
    );
    expect((await setPlan(OWNER, { email: 'alice@example.com', plan: 'gold' })).statusCode).toBe(
      400,
    );
    // The target is never taken from a user id in the body.
    expect(
      (await setPlan(OWNER, { email: 'alice@example.com', plan: 'pro', userId: ALICE })).statusCode,
    ).toBe(400);
  });
});

describe('quota gate', () => {
  const limits = {
    free: {
      translation_ms: 1000,
      cloud_stt_ms: 0,
      debriefs: 2,
      assist_daily: 1,
      agent_messages: 0,
    },
    pro: {
      translation_ms: null,
      cloud_stt_ms: null,
      debriefs: null,
      assist_daily: null,
      agent_messages: 5,
    },
    ultra: {
      translation_ms: null,
      cloud_stt_ms: null,
      debriefs: null,
      assist_daily: null,
      agent_messages: 5,
    },
  };
  const make = (now = new Date('2026-11-14T05:00:00Z')) => {
    const repo = createInMemoryUsageRepository(EMAILS);
    const { service } = createUsageModule(repo, {
      limits,
      isAdmin: async (id) => id === OWNER,
      now: () => now,
    });
    return service;
  };

  it('reserves up to the limit then refuses with the allowance in details', async () => {
    const usage = make();
    await usage.reserve(ALICE, 'debriefs');
    await usage.reserve(ALICE, 'debriefs');
    await expect(usage.reserve(ALICE, 'debriefs')).rejects.toMatchObject({
      code: 'QUOTA_EXCEEDED',
      details: { metric: 'debriefs', plan: 'free', used: 2, limit: 2 },
    });
  });

  it('refuses a zero limit without reserving', async () => {
    const usage = make();
    const result = await usage.tryReserve(ALICE, 'cloud_stt_ms', 500);
    expect(result.ok).toBe(false);
    expect((await usage.status(ALICE, 'cloud_stt_ms')).used).toBe(0);
  });

  it('does not oversell when requests race for the last slot', async () => {
    const usage = make();
    const results = await Promise.all(
      Array.from({ length: 6 }, () => usage.tryReserve(ALICE, 'debriefs')),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(2);
  });

  it('keeps counting for an admin without ever refusing', async () => {
    const usage = make();
    for (let i = 0; i < 5; i += 1)
      expect((await usage.tryReserve(OWNER, 'debriefs')).ok).toBe(true);
    expect(await usage.status(OWNER, 'debriefs')).toMatchObject({ used: 5, limit: null });
  });

  it('starts from zero in a new period', async () => {
    const repo = createInMemoryUsageRepository(EMAILS);
    let now = new Date('2026-11-14T05:00:00Z');
    const { service } = createUsageModule(repo, {
      limits,
      isAdmin: async () => false,
      now: () => now,
    });
    await service.reserve(ALICE, 'debriefs');
    await service.reserve(ALICE, 'debriefs');
    now = new Date('2026-11-30T17:00:00Z'); // 00:00 on 1 December in Vietnam
    expect((await service.status(ALICE, 'debriefs')).used).toBe(0);
    await expect(service.reserve(ALICE, 'debriefs')).resolves.toMatchObject({ used: 1 });
  });
});
