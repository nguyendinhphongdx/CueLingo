import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAN_PRICES,
  periodStart,
  USAGE_METRICS,
  type AdminUserRow,
} from '@cuelingo/shared';
import {
  createAdminUsersModule,
  createPostgresAdminUsersRepository,
  type AdminUsersRepository,
} from '../../src/modules/admin-users';
import { createPostgresBillingRepository } from '../../src/modules/billing';
import { createPostgresUsageRepository } from '../../src/modules/usage';
import { startMigratedPostgres, type TestDatabase } from './postgres';

const NOW = new Date('2026-11-15T05:00:00Z');
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
const ahead = (days: number) => new Date(NOW.getTime() + days * DAY);

/** The SQL that only a real database can check: month edge in Vietnam time, keyset, ILIKE escaping, dropped sessions. */
describe('admin users on real Postgres', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  let repo: AdminUsersRepository;
  const ids: Record<string, string> = {};

  const newUser = async (key: string, email: string, createdAt: Date | string, name = key) => {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO auth_user (name, email, "createdAt") VALUES (${name}, ${email}, ${createdAt}) RETURNING id`;
    ids[key] = row!.id;
    return row!.id;
  };
  const plan = (key: string, p: string, source: string, expiresAt: Date | null) =>
    sql`INSERT INTO user_plans (user_id, plan, source, expires_at) VALUES (${ids[key]!}, ${p}, ${source}, ${expiresAt})`;
  const order = (key: string, p: string, amount: number, status: string, paidAt: Date | null) =>
    sql`INSERT INTO billing_orders (user_id, order_code, provider, plan, period, amount, status, expires_at, paid_at)
      VALUES (${ids[key]!}, nextval('billing_order_code_seq'), 'fake', ${p}, 'month', ${amount}, ${status},
        ${ahead(1)}, ${paidAt})`;
  const session = (key: string, startedAt: Date, status: string) =>
    sql`INSERT INTO sessions (user_id, started_at, assist_level, status) VALUES (${ids[key]!}, ${startedAt}, 1, ${status})`;
  const all = async (filter: Parameters<AdminUsersRepository['list']>[0] = {}) => {
    const rows: AdminUserRow[] = [];
    let after = filter.after;
    for (let guard = 0; guard < 20; guard++) {
      const page = await repo.list({ ...filter, after }, NOW, 50);
      rows.push(...page.items);
      if (!page.next) return rows;
      after = page.next;
    }
    throw new Error('paging does not end');
  };

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
    repo = createPostgresAdminUsersRepository(sql);

    await newUser('admin', 'admin@x.test', ago(60));
    await newUser('proLive', 'pro-live@x.test', ago(2), 'Pro Live');
    await newUser('ultraManual', 'ultra@x.test', ago(10));
    await newUser('proExpired', 'pro-expired@x.test', ago(20));
    await newUser('freeRow', 'free-row@x.test', ago(30));
    await newUser('none', 'none@x.test', ago(31));
    await plan('proLive', 'pro', 'payment', ahead(3));
    await plan('ultraManual', 'ultra', 'manual', null);
    await plan('proExpired', 'pro', 'payment', ago(1));
    await plan('freeRow', 'free', 'manual', null);

    // Orders around the month edge in Vietnam (UTC+7): 1 Nov 00:00 is 31 Oct 17:00 UTC.
    await order('proLive', 'pro', 100, 'paid', new Date('2026-10-31T16:30:00Z')); // 23:30 on 31 Oct: last month
    await order('proLive', 'pro', 200, 'paid', new Date('2026-10-31T17:00:00Z')); // 00:00 on 1 Nov: counts
    await order('proLive', 'pro', 300, 'paid', ago(1));
    await order('proLive', 'pro', 400, 'cancelled', NOW); // never paid, whatever paid_at says
    await order('proLive', 'pro', 500, 'pending', null);
    await order('proLive', 'pro', 600, 'paid', new Date('2026-11-30T16:59:59Z')); // last second of Nov in Vietnam
    await order('proLive', 'pro', 700, 'paid', new Date('2026-11-30T17:00:00Z')); // 1 Dec in Vietnam

    // Usage: this month and last month (period starts in Vietnam time).
    const thisMonth = periodStart('translation_ms', NOW);
    await sql`INSERT INTO usage_counters (user_id, period_start, metric, amount) VALUES
      (${ids.proLive!}, ${thisMonth}, 'translation_ms', 3600000),
      (${ids.proLive!}, ${periodStart('translation_ms', ago(40))}, 'translation_ms', 999)`;

    // Last activity ignores deleted sessions.
    await session('proLive', ago(5), 'ended');
    await session('proLive', ago(1), 'deleted');
    await session('ultraManual', ago(2), 'deleted');
    await session('freeRow', new Date(NOW.getTime() - 3 * 3_600_000), 'live');

    // Characters ILIKE treats as wildcards.
    await newUser('under', 'a_b@esc.test', ago(100), 'Under');
    await newUser('plain', 'axb@esc.test', ago(101), 'Plain');
    await newUser('percent', '100%@esc.test', ago(102), 'Percent');
    await newUser('slash', 'back\\slash@esc.test', ago(103), 'Slash');

    // Created within one millisecond of each other: a JS Date cannot tell them apart.
    for (const n of [1, 2, 3]) {
      await newUser(`us${n}`, `us${n}@us.test`, `2026-01-01 00:00:00.00000${n}+00`);
    }
    // The same instant: only the id breaks the tie.
    for (const n of [1, 2, 3, 4])
      await newUser(`tie${n}`, `tie${n}@tie.test`, '2026-01-02 00:00:00+00');
    // A full set of pages.
    await sql`INSERT INTO auth_user (name, email, "createdAt")
      SELECT 'Bulk ' || i, 'bulk' || i || '@bulk.test', ${ago(200)}::timestamptz - i * interval '1 second'
      FROM generate_series(1, 120) AS i`;
  });
  afterAll(async () => {
    await sql.end();
    await db.stop();
  });

  it('counts plans in force and this month revenue by the Vietnam calendar (AC1)', async () => {
    const dashboard = await repo.dashboard(NOW);
    expect(dashboard).toEqual({
      generatedAt: NOW.toISOString(),
      totalUsers: 6 + 4 + 3 + 4 + 120,
      // The expired Pro and the Free row are free; so is everyone without a row.
      byPlan: { free: 6 + 4 + 3 + 4 + 120 - 2, pro: 1, ultra: 1 },
      newUsers7d: 1,
      // 200 + 300 + 600. Not 100 (23:30 on 31 Oct), 400 (cancelled), 500 (pending), 700 (1 Dec).
      revenueThisMonth: 1100,
      // Only the live Pro ending in 3 days; Ultra has no end, Pro-expired ended yesterday.
      expiringIn7d: 1,
    });
  });

  it('shows a plan that ended as free and agrees with the quota gate (AC3)', async () => {
    const rows = await all({ q: '@x.test' });
    const byEmail = Object.fromEntries(rows.map((r) => [r.email, r]));
    expect(byEmail['pro-expired@x.test']).toMatchObject({
      plan: 'free',
      source: 'payment',
      expiresAt: ago(1).toISOString(),
    });
    expect(byEmail['none@x.test']).toMatchObject({ plan: 'free', source: null, expiresAt: null });

    // The same expression lives in usage.repository.ts: the two must name the same plan for everyone.
    const usage = createPostgresUsageRepository(sql);
    const starts = Object.fromEntries(
      USAGE_METRICS.map((m) => [m, periodStart(m, NOW)]),
    ) as Parameters<typeof usage.snapshot>[1];
    for (const row of rows) {
      expect((await usage.snapshot(row.id, starts, NOW)).plan, row.email).toBe(row.plan);
    }

    expect((await all({ plan: 'free', q: '@x.test' })).map((r) => r.email).sort()).toEqual([
      'admin@x.test',
      'free-row@x.test',
      'none@x.test',
      'pro-expired@x.test',
    ]);
    expect((await all({ plan: 'pro' })).map((r) => r.email)).toEqual(['pro-live@x.test']);
    expect((await all({ plan: 'ultra' })).map((r) => r.email)).toEqual(['ultra@x.test']);
    expect((await all({ expiring: true })).map((r) => r.email)).toEqual(['pro-live@x.test']);
  });

  it('reads this month translation time and the latest session that was not deleted (AC2)', async () => {
    const byKey = async (key: string) => (await repo.find(ids[key]!, NOW))!;
    expect((await byKey('proLive')).translationMsThisMonth).toBe(3_600_000);
    expect((await byKey('proLive')).lastActiveAt).toBe(ago(5).toISOString());
    expect((await byKey('ultraManual')).lastActiveAt).toBeNull();
    expect((await byKey('freeRow')).lastActiveAt).toBe(
      new Date(NOW.getTime() - 3 * 3_600_000).toISOString(),
    );
    expect((await byKey('none')).translationMsThisMonth).toBe(0);
    expect(await repo.find('00000000-0000-4000-8000-000000000099', NOW)).toBeNull();
  });

  it('pages newest first without a repeat or a gap, even for equal and near-equal timestamps (AC2)', async () => {
    const rows = await all();
    expect(rows).toHaveLength(137);
    expect(new Set(rows.map((r) => r.id)).size).toBe(137);
    const times = rows.map((r) => new Date(r.createdAt).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);

    // Pages of 50 on the bulk users alone.
    const first = await repo.list({ q: 'bulk.test' }, NOW, 50);
    const second = await repo.list({ q: 'bulk.test', after: first.next! }, NOW, 50);
    const third = await repo.list({ q: 'bulk.test', after: second.next! }, NOW, 50);
    expect([first.items.length, second.items.length, third.items.length]).toEqual([50, 50, 20]);
    expect(third.next).toBeNull();

    // Microseconds: 3 rows inside one millisecond, taken one at a time, each exactly once.
    const seen: string[] = [];
    let after = undefined as Awaited<ReturnType<typeof repo.list>>['next'] | undefined;
    for (let i = 0; i < 4; i++) {
      const page = await repo.list({ q: 'us.test', after: after ?? undefined }, NOW, 1);
      seen.push(...page.items.map((r) => r.email));
      after = page.next;
      if (!page.next) break;
    }
    expect(seen).toEqual(['us3@us.test', 'us2@us.test', 'us1@us.test']);

    // Ties: four rows with the same instant, one at a time.
    const tied: string[] = [];
    after = undefined;
    for (let i = 0; i < 5; i++) {
      const page = await repo.list({ q: 'tie.test', after: after ?? undefined }, NOW, 1);
      tied.push(...page.items.map((r) => r.email));
      after = page.next;
      if (!page.next) break;
    }
    expect(tied).toHaveLength(4);
    expect(new Set(tied).size).toBe(4);
  });

  it('works through the service: an opaque cursor survives microseconds, a broken one is refused', async () => {
    const { service } = createAdminUsersModule(repo, {
      isAdmin: async () => true,
      usage: {} as never,
      billing: {} as never,
      now: () => NOW,
    });
    const first = await service.list('admin', { q: 'us.test' });
    expect(first.items).toHaveLength(3);
    const { service: small } = createAdminUsersModule(
      { ...repo, list: (f, n) => repo.list(f, n, 2) },
      { isAdmin: async () => true, usage: {} as never, billing: {} as never, now: () => NOW },
    );
    const page1 = await small.list('admin', { q: 'us.test' });
    expect(page1.items.map((r) => r.email)).toEqual(['us3@us.test', 'us2@us.test']);
    const page2 = await small.list('admin', { q: 'us.test', cursor: page1.nextCursor });
    expect(page2.items.map((r) => r.email)).toEqual(['us1@us.test']);
    await expect(service.list('admin', { cursor: 'garbage' })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('treats % _ and \\ in the search text as plain characters (AC3)', async () => {
    const find = async (q: string) => (await all({ q })).map((r) => r.email).sort();
    expect(await find('_')).toEqual(['a_b@esc.test']);
    expect(await find('%')).toEqual(['100%@esc.test']);
    expect(await find('\\')).toEqual(['back\\slash@esc.test']);
    expect(await find('A_B')).toEqual(['a_b@esc.test']);
    expect(await find('ax')).toEqual(['axb@esc.test']);
    // The name is searched too.
    expect(await find('pro live')).toEqual(['pro-live@x.test']);
  });

  it('grants a plan and records a 0 dong order in one transaction; revenue stays the same (AC5)', async () => {
    const billing = createPostgresBillingRepository(sql);
    const prices = DEFAULT_PLAN_PRICES;
    const revenueBefore = (await repo.dashboard(NOW)).revenueThisMonth;
    const grant = (plan: 'free' | 'pro' | 'ultra', period?: 'month' | 'year', at = NOW) =>
      billing.grant(ids.none!, { adminId: ids.admin!, plan, period, now: at, prices });

    const first = await grant('ultra', 'month');
    expect(first.previous).toBeNull();
    expect(first.orderId).not.toBeNull();
    expect(first.current.expiresAt?.toISOString()).toBe('2026-12-15T05:00:00.000Z');
    const [row] =
      await sql`SELECT plan, source, set_by, expires_at FROM user_plans WHERE user_id = ${ids.none!}`;
    expect(row).toMatchObject({ plan: 'ultra', source: 'manual', set_by: ids.admin });
    expect((await repo.find(ids.none!, NOW))!.plan).toBe('ultra');
    const [order] = await sql`SELECT * FROM billing_orders WHERE id = ${first.orderId!}`;
    expect(order).toMatchObject({
      user_id: ids.none,
      provider: 'admin',
      plan: 'ultra',
      period: 'month',
      amount: 0,
      status: 'paid',
      qr_code: null,
      checkout_url: null,
    });
    expect(order!.paid_at.toISOString()).toBe(NOW.toISOString());
    expect(order!.plan_expires_at.toISOString()).toBe('2026-12-15T05:00:00.000Z');

    // Two grants at once add one period each, in turn: the plan row is locked.
    const [a, b] = await Promise.all([grant('ultra', 'month'), grant('ultra', 'month')]);
    expect([a.current.expiresAt, b.current.expiresAt].map((d) => d!.toISOString()).sort()).toEqual([
      '2027-01-15T05:00:00.000Z',
      '2027-02-15T05:00:00.000Z',
    ]);

    // Down to Pro: starts now. Free: no end date and no new order.
    const down = await grant('pro', 'month');
    expect(down.previous).toMatchObject({ plan: 'ultra', source: 'manual' });
    expect(down.current.expiresAt?.toISOString()).toBe('2026-12-15T05:00:00.000Z');
    const free = await grant('free');
    expect(free.orderId).toBeNull();
    expect(free.current.expiresAt).toBeNull();
    const orders = await sql`SELECT amount FROM billing_orders WHERE user_id = ${ids.none!}`;
    expect(orders).toHaveLength(4);

    // Revenue counts money only; the order limit does not count grants.
    expect((await repo.dashboard(NOW)).revenueThisMonth).toBe(revenueBefore);
    expect(await billing.countCreatedSince(ids.none!, ago(1))).toBe(0);
    const detail = await createPostgresBillingRepository(sql).listForUser(ids.none!, 10);
    expect(detail.every((o) => o.provider === 'admin' && o.amount === 0)).toBe(true);
  });
});
