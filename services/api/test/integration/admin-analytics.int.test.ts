import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolvePlanLimits, type PlanLimitTable } from '@cuelingo/shared';
import {
  createPostgresAdminAnalyticsRepository,
  type AdminAnalyticsRepository,
} from '../../src/modules/admin-analytics';
import { createPostgresUsageRepository } from '../../src/modules/usage';
import { startMigratedPostgres, type TestDatabase } from './postgres';

// 12:00 on 15 Nov 2026 in Vietnam. The month began at 2026-10-31T17:00Z.
const NOW = new Date('2026-11-15T05:00:00Z');
const MONTH = new Date('2026-10-31T17:00:00Z');
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
const ahead = (days: number) => new Date(NOW.getTime() + days * DAY);

describe('admin analytics on real Postgres', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  let repo: AdminAnalyticsRepository;
  let item: string;
  const ids: Record<string, string> = {};

  const user = async (key: string, createdAt: Date) => {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO auth_user (name, email, "createdAt") VALUES (${key}, ${`${key}@an.test`}, ${createdAt}) RETURNING id`;
    ids[key] = row!.id;
  };
  const meeting = (key: string, startedAt: Date, endedAt: Date | null, status = 'ended') =>
    sql`INSERT INTO sessions (user_id, started_at, ended_at, assist_level, status)
      VALUES (${ids[key]!}, ${startedAt}, ${endedAt}, 1, ${status})`;
  const review = (key: string, at: Date) =>
    sql`INSERT INTO review_logs (user_id, item_id, exercise_type, rating, at) VALUES (${ids[key]!}, ${item}, 'cloze', 3, ${at})`;
  const order = (
    key: string,
    o: {
      plan?: string;
      period?: string;
      amount: number;
      status: string;
      provider?: string;
      paidAt?: Date | null;
      createdAt?: Date;
    },
  ) =>
    sql`INSERT INTO billing_orders (user_id, order_code, provider, plan, period, amount, status, expires_at, paid_at, created_at)
      VALUES (${ids[key]!}, nextval('billing_order_code_seq'), ${o.provider ?? 'fake'}, ${o.plan ?? 'pro'},
        ${o.period ?? 'month'}, ${o.amount}, ${o.status}, ${ahead(1)}, ${o.paidAt ?? null}, ${o.createdAt ?? NOW})`;
  const counter = (key: string, metric: string, amount: number, start = MONTH) =>
    sql`INSERT INTO usage_counters (user_id, period_start, metric, amount) VALUES (${ids[key]!}, ${start}, ${metric}, ${amount})`;

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
    repo = createPostgresAdminAnalyticsRepository(sql);
    const [lexical] = await sql<{ id: string }[]>`
      INSERT INTO lexical_items (lemma, type) VALUES ('hello', 'word') RETURNING id`;
    item = lexical!.id;
  });
  afterAll(async () => {
    await sql.end();
    await db.stop();
  });

  it('gives empty but complete series on an empty database', async () => {
    const overview = await repo.overview(NOW);
    expect(overview.daily).toHaveLength(30);
    expect(overview.daily.at(-1)!.date).toBe('2026-11-15');
    expect(overview.daily[0]!.date).toBe('2026-10-17');
    expect(overview.activeUsers).toEqual({ d1: 0, d7: 0, d30: 0 });
    const revenue = await repo.revenue(NOW);
    expect(revenue.daily).toHaveLength(30);
    expect(revenue.monthly).toHaveLength(12);
    expect(revenue.monthly.at(-1)!.month).toBe('2026-11');
    expect(revenue.monthly[0]!.month).toBe('2025-12');
    expect(revenue.byPlanPeriod).toHaveLength(4);
    expect(revenue.paidRate).toBeNull();
    const usage = await repo.usage(NOW, resolvePlanLimits());
    expect(usage.aiCostUsdThisMonth).toBeNull();
    expect(usage.metrics).toHaveLength(4);
    const activity = await repo.activity(NOW);
    expect(activity.daily).toHaveLength(30);
    expect(activity.meetingUsers).toEqual({ dau: 0, wau: 0, mau: 0 });
  });

  describe('overview', () => {
    it('counts new and active people; a review counts, a deleted meeting does not', async () => {
      await user('old', ago(90));
      await user('new3', ago(3));
      await user('new20', ago(20));
      await user('rev', ago(90));
      await user('gone', ago(90));
      await meeting('new3', ago(0.2), ago(0.1));
      await meeting('new3', ago(2), ago(1.9));
      await review('rev', ago(5));
      await meeting('gone', ago(0.1), null, 'deleted');
      await meeting('old', ago(40), ago(39.9));
      const o = await repo.overview(NOW);
      expect(o.newUsers).toEqual({ d7: 1, d30: 2 });
      expect(o.activeUsers).toEqual({ d1: 1, d7: 2, d30: 2 });
      const today = o.daily.at(-1)!;
      expect(today).toMatchObject({ date: '2026-11-15', activeUsers: 1 });
      expect(o.daily.reduce((n, d) => n + d.newUsers, 0)).toBe(2);
      // `new3` is active on two different days but counted once per day.
      expect(o.daily.filter((d) => d.activeUsers > 0)).toHaveLength(3);
    });
  });

  describe('revenue', () => {
    it('leaves admin grants out of revenue and puts them in grants; day edge is Vietnam midnight', async () => {
      // 16:59Z on 14 Nov is 23:59 in Vietnam, 17:00Z is already 15 Nov.
      await order('new3', {
        amount: 100,
        status: 'paid',
        paidAt: new Date('2026-11-14T16:59:00Z'),
      });
      await order('new3', {
        amount: 200,
        status: 'paid',
        paidAt: new Date('2026-11-14T17:00:00Z'),
        plan: 'ultra',
        period: 'year',
      });
      // The last second of October in Vietnam, then the first of November.
      await order('new3', {
        amount: 1000,
        status: 'paid',
        paidAt: new Date('2026-10-31T16:59:59Z'),
      });
      await order('new3', {
        amount: 2000,
        status: 'paid',
        paidAt: new Date('2026-10-31T17:00:00Z'),
      });
      await order('new3', { amount: 0, status: 'paid', provider: 'admin', paidAt: ago(1) });
      await order('new3', { amount: 50, status: 'pending' });
      await order('new3', { amount: 50, status: 'expired', createdAt: ago(10) });
      await order('new3', { amount: 50, status: 'pending', createdAt: ago(45) });
      const r = await repo.revenue(NOW);
      const day = (date: string) => r.daily.find((d) => d.date === date)!.amount;
      expect(day('2026-11-14')).toBe(100);
      expect(day('2026-11-15')).toBe(200);
      const month = (m: string) => r.monthly.find((x) => x.month === m)!.amount;
      expect(month('2026-10')).toBe(1000);
      expect(month('2026-11')).toBe(2000 + 100 + 200);
      expect(r.adminGrants).toBe(1);
      expect(r.ordersByStatus).toEqual({ pending: 1, paid: 4, expired: 1, cancelled: 0 });
      expect(r.paidRate).toBeCloseTo(4 / 6);
      expect(r.byPlanPeriod.find((x) => x.plan === 'ultra' && x.period === 'year')).toMatchObject({
        orders: 1,
        amount: 200,
      });
      expect(r.byPlanPeriod.find((x) => x.plan === 'pro' && x.period === 'month')).toMatchObject({
        orders: 3,
        amount: 3100,
      });
    });
  });

  describe('usage', () => {
    it('totals, means per plan in force, 80% and 100% from custom limits, and AI cost this month', async () => {
      const limits: PlanLimitTable = resolvePlanLimits({
        free: { debriefs: 10 },
        pro: { debriefs: 100 },
        ultra: { debriefs: null },
      });
      await user('p1', ago(30));
      await user('ended', ago(30));
      await sql`INSERT INTO user_plans (user_id, plan, source, expires_at) VALUES
        (${ids.p1!}, 'pro', 'manual', ${ahead(10)}), (${ids.ended!}, 'pro', 'payment', ${ago(1)})`;
      await counter('p1', 'debriefs', 80);
      await counter('ended', 'debriefs', 10);
      await counter('new3', 'debriefs', 8);
      await counter('old', 'debriefs', 4, new Date('2026-09-30T17:00:00Z'));
      await counter('new3', 'translation_ms', 3_600_000);
      await counter('new3', 'assist_daily', 99);
      await sql`INSERT INTO events (id, user_id, type, at, cost_usd, payload) VALUES
        (gen_random_uuid(), ${ids.new3!}, 'ai_call', ${ago(1)}, 0.25, '{"task":"x"}'),
        (gen_random_uuid(), ${ids.new3!}, 'ai_call', ${ago(2)}, 0.5, '{}'),
        (gen_random_uuid(), ${ids.new3!}, 'ai_call', ${new Date('2026-10-31T16:59:00Z')}, 9, '{}'),
        (gen_random_uuid(), ${ids.new3!}, 'other', ${ago(1)}, 7, '{}')`;
      const u = await repo.usage(NOW, limits);
      expect(u.periodStart).toBe(MONTH.toISOString());
      expect(u.aiCostUsdThisMonth).toBeCloseTo(0.75);
      const debriefs = u.metrics.find((m) => m.metric === 'debriefs')!;
      expect(debriefs.total).toBe(98);
      // Free people (everyone but p1): new3 8/10 = 80%, ended 10/10 = 100%. p1 is Pro: 80/100 = 80%.
      expect(debriefs.atLeast80).toBe(3);
      expect(debriefs.atLeast100).toBe(1);
      expect(debriefs.averageByPlan.ultra).toBeNull();
      expect(debriefs.averageByPlan.pro).toBe(80);
      // 6 people are free (7 minus p1), together 8 + 10.
      expect(debriefs.averageByPlan.free).toBe(3);
      const stt = u.metrics.find((m) => m.metric === 'cloud_stt_ms')!;
      expect(stt.total).toBe(0);
      expect(stt.atLeast80).toBe(0);
      const translation = u.metrics.find((m) => m.metric === 'translation_ms')!;
      expect(translation.total).toBe(3_600_000);
      expect(translation.atLeast80).toBe(0);
      // Nothing limited: thresholds do not apply.
      const none = await repo.usage(
        NOW,
        resolvePlanLimits({
          free: { debriefs: null },
          pro: { debriefs: null },
          ultra: { debriefs: null },
        }),
      );
      expect(none.metrics.find((m) => m.metric === 'debriefs')).toMatchObject({
        atLeast80: null,
        atLeast100: null,
      });
    });

    it('agrees with the usage snapshot of the same person about the plan in force', async () => {
      const snapshot = await createPostgresUsageRepository(sql).snapshot(
        ids.ended!,
        {
          translation_ms: MONTH,
          cloud_stt_ms: MONTH,
          debriefs: MONTH,
          agent_messages: MONTH,
          assist_daily: MONTH,
          lessons_daily: MONTH,
          lesson_practice_daily: MONTH,
          meeting_ask_daily: MONTH,
        },
        NOW,
      );
      expect(snapshot.plan).toBe('free');
      expect(snapshot.amounts.debriefs).toBe(10);
    });
  });

  describe('activity', () => {
    it('counts meetings per Vietnam day, hours only of ended ones, and users by window', async () => {
      const a = await repo.activity(NOW);
      // A meeting at 2026-11-14T17:30Z is on the 15th in Vietnam.
      await user('night', ago(90));
      await meeting('night', new Date('2026-11-14T17:30:00Z'), new Date('2026-11-14T18:30:00Z'));
      await meeting('night', new Date('2026-11-14T16:30:00Z'), null);
      const b = await repo.activity(NOW);
      const day = (r: typeof a, date: string) => r.daily.find((d) => d.date === date)!;
      expect(day(b, '2026-11-15').meetings - day(a, '2026-11-15').meetings).toBe(1);
      expect(day(b, '2026-11-15').hours - day(a, '2026-11-15').hours).toBeCloseTo(1);
      expect(day(b, '2026-11-14').meetings - day(a, '2026-11-14').meetings).toBe(1);
      expect(day(b, '2026-11-14').hours - day(a, '2026-11-14').hours).toBeCloseTo(0);
      // `new3` met twice in 2 days, `night` twice in 1 day; the deleted meeting of `gone` and the reviewer do not count.
      expect(b.meetingUsers).toEqual({ dau: 2, wau: 2, mau: 2 });
    });
  });
});
