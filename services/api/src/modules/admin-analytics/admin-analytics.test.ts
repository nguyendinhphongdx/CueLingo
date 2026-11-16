import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryAdminRepository } from '../admin';
import { createInMemoryAdminUsersRepository } from '../admin-users';
import { createInMemoryAdminAnalyticsRepository, type AdminAnalyticsRepository } from './index';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const OWNER = uuid(1);
const ALICE = uuid(2);
const NOW = new Date('2026-11-15T05:00:00Z');
const as = (user: string) => ({ [TEST_USER_HEADER]: user });
const ROUTES = ['overview', 'revenue', 'usage', 'activity'] as const;
const url = (name: string) => `/v1/admin/analytics/${name}`;

describe('admin analytics', () => {
  let app: FastifyInstance;
  let clock = NOW;
  const calls: string[] = [];
  afterEach(() => app.close());

  async function build(values: Parameters<typeof createInMemoryAdminAnalyticsRepository>[0] = {}) {
    clock = NOW;
    calls.length = 0;
    const inner = createInMemoryAdminAnalyticsRepository(values);
    const spy: AdminAnalyticsRepository = {
      overview: (n) => (calls.push('overview'), inner.overview(n)),
      revenue: (n) => (calls.push('revenue'), inner.revenue(n)),
      usage: (n, l) => (calls.push('usage'), inner.usage(n, l)),
      activity: (n) => (calls.push('activity'), inner.activity(n)),
    };
    const emails = { [OWNER]: 'owner@example.com', [ALICE]: 'alice@example.com' };
    app = await buildTestApp({
      adminEmails: ['owner@example.com'],
      now: () => clock,
      repos: {
        admin: createInMemoryAdminRepository(emails),
        adminUsers: createInMemoryAdminUsersRepository([
          {
            id: OWNER,
            email: 'owner@example.com',
            name: 'Owner',
            createdAt: new Date('2026-09-01'),
          },
          { id: ALICE, email: 'alice@example.com', name: 'Alice', createdAt: NOW },
        ]),
        adminAnalytics: spy,
      },
    });
  }
  const get = (user: string, name: string) =>
    app.inject({ method: 'GET', url: url(name), headers: as(user) });

  describe('forbidden', () => {
    it('answers 403 to a normal user, even once an admin has filled the cache, and 401 without a session', async () => {
      await build();
      for (const name of ROUTES) {
        expect((await get(OWNER, name)).statusCode).toBe(200);
        const forbidden = await get(ALICE, name);
        expect(forbidden.statusCode).toBe(403);
        expect(forbidden.body).not.toContain('totalUsers');
        expect((await app.inject({ method: 'GET', url: url(name) })).statusCode).toBe(401);
      }
    });
  });

  describe('overview', () => {
    it('joins the dashboard of admin-users with the new numbers, with 30 days', async () => {
      await build({
        overview: { newUsers: { d7: 1, d30: 2 }, activeUsers: { d1: 1, d7: 2, d30: 2 } },
      });
      const body = (await get(OWNER, 'overview')).json();
      expect(body).toMatchObject({
        totalUsers: 2,
        byPlan: { free: 2, pro: 0, ultra: 0 },
        revenueThisMonth: 0,
        expiringIn7d: 0,
        newUsers: { d7: 1, d30: 2 },
        activeUsers: { d1: 1, d7: 2, d30: 2 },
        generatedAt: NOW.toISOString(),
      });
      expect(body.daily).toHaveLength(30);
    });
  });

  describe('revenue', () => {
    it('has 30 days, 12 months, all 4 plan-period pairs and a null rate when there is no order', async () => {
      await build();
      const body = (await get(OWNER, 'revenue')).json();
      expect(body.daily).toHaveLength(30);
      expect(body.monthly).toHaveLength(12);
      expect(body.byPlanPeriod).toHaveLength(4);
      expect(body.ordersByStatus).toEqual({ pending: 0, paid: 0, expired: 0, cancelled: 0 });
      expect(body.paidRate).toBeNull();
      expect(body.adminGrants).toBe(0);
    });
  });

  describe('usage', () => {
    it('lists the 4 limits; thresholds are 0 where a plan has a limit', async () => {
      await build();
      const body = (await get(OWNER, 'usage')).json();
      expect(body.metrics.map((m: { metric: string }) => m.metric)).toEqual([
        'translation_ms',
        'cloud_stt_ms',
        'debriefs',
        'agent_messages',
      ]);
      expect(body.metrics[0]).toMatchObject({ atLeast80: 0, atLeast100: 0 });
      expect(body.aiCostUsdThisMonth).toBeNull();
    });
  });

  describe('activity', () => {
    it('wraps the numbers of /v1/admin/metrics with days and meeting users', async () => {
      await build({ activity: { meetingUsers: { dau: 1, wau: 2, mau: 3 } } });
      const body = (await get(OWNER, 'activity')).json();
      const metrics = (
        await app.inject({ method: 'GET', url: '/v1/admin/metrics', headers: as(OWNER) })
      ).json();
      expect({ ...body.metrics, generatedAt: 0 }).toEqual({ ...metrics, generatedAt: 0 });
      expect(body.daily).toHaveLength(30);
      expect(body.meetingUsers).toEqual({ dau: 1, wau: 2, mau: 3 });
    });
  });

  describe('no identifiers', () => {
    it('carries no email, no id and nothing that can be written', async () => {
      await build();
      for (const name of ROUTES) {
        const body = (await get(OWNER, name)).body;
        expect(body).not.toContain('@');
        expect(body).not.toContain(OWNER);
        expect(body).not.toContain(ALICE);
      }
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
        const res = await app.inject({
          method,
          url: url('overview'),
          headers: as(OWNER),
          payload: {},
        });
        expect(res.statusCode).toBe(404);
      }
    });
  });

  describe('cache', () => {
    it('reuses an answer for 60 seconds, then asks the repository again', async () => {
      await build();
      await get(OWNER, 'revenue');
      clock = new Date(NOW.getTime() + 59_000);
      const again = await get(OWNER, 'revenue');
      expect(calls).toEqual(['revenue']);
      expect(again.json().generatedAt).toBe(NOW.toISOString());
      clock = new Date(NOW.getTime() + 61_000);
      await get(OWNER, 'revenue');
      expect(calls).toEqual(['revenue', 'revenue']);
    });

    it('runs the SQL once for requests at the same time', async () => {
      await build();
      await Promise.all([get(OWNER, 'usage'), get(OWNER, 'usage'), get(OWNER, 'usage')]);
      expect(calls).toEqual(['usage']);
    });
  });
});
