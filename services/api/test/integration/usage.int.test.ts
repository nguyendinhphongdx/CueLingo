import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPostgresUsageRepository } from '../../src/modules/usage';
import { startMigratedPostgres, type TestDatabase } from './postgres';

/** The reservation SQL must not oversell when requests race, and counters are scoped by user. */
describe('usage counters on real Postgres', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  let alice: string;
  let bob: string;
  const start = new Date('2026-10-31T17:00:00Z');
  const NOW = new Date('2026-11-14T05:00:00Z');

  const newUser = async (email: string) =>
    (
      await sql<
        { id: string }[]
      >`INSERT INTO auth_user (name, email) VALUES (${email}, ${email}) RETURNING id`
    )[0]!.id;

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
    alice = await newUser('alice@example.com');
    bob = await newUser('bob@example.com');
  });
  afterAll(async () => {
    await sql.end();
    await db.stop();
  });

  it('grants exactly `limit` slots under concurrent reservations', async () => {
    const repo = createPostgresUsageRepository(sql);
    const results = await Promise.all(
      Array.from({ length: 12 }, () => repo.reserve(alice, 'debriefs', start, 1, 5)),
    );
    expect(results.filter((r) => r !== null)).toHaveLength(5);
    const snap = await repo.snapshot(
      alice,
      {
        translation_ms: start,
        cloud_stt_ms: start,
        debriefs: start,
        assist_daily: start,
        agent_messages: start,
      },
      NOW,
    );
    expect(snap.amounts.debriefs).toBe(5);
    expect(snap.plan).toBe('free');
  });

  it('keeps counters per user and per period', async () => {
    const repo = createPostgresUsageRepository(sql);
    const starts = {
      translation_ms: start,
      cloud_stt_ms: start,
      debriefs: start,
      assist_daily: new Date('2026-11-13T17:00:00Z'),
      agent_messages: start,
    };
    await repo.add(bob, 'translation_ms', start, 1500);
    await repo.add(bob, 'assist_daily', new Date('2026-11-12T17:00:00Z'), 9);
    const snap = await repo.snapshot(bob, starts, NOW);
    expect(snap.amounts.translation_ms).toBe(1500);
    expect(snap.amounts.assist_daily).toBe(0);
    expect((await repo.snapshot(alice, starts, NOW)).amounts.translation_ms).toBe(0);
  });

  it('stores a plan, finds a user by email ignoring case, and cascades with the account', async () => {
    const repo = createPostgresUsageRepository(sql);
    expect(await repo.userIdByEmail('ALICE@example.com')).toBe(alice);
    expect(await repo.userIdByEmail('nobody@example.com')).toBeNull();
    await sql`INSERT INTO user_plans (user_id, plan, set_by) VALUES (${alice}, 'ultra', ${bob})`;
    const [row] = await sql`SELECT plan, set_by FROM user_plans WHERE user_id = ${alice}`;
    expect(row).toMatchObject({ plan: 'ultra', set_by: bob });
    await sql`DELETE FROM auth_user WHERE id = ${alice}`;
    expect(await sql`SELECT 1 FROM usage_counters WHERE user_id = ${alice}`).toHaveLength(0);
    expect(await sql`SELECT 1 FROM user_plans WHERE user_id = ${alice}`).toHaveLength(0);
  });

  it('treats a plan past its end date as free, in both snapshot and gate (AC7)', async () => {
    const repo = createPostgresUsageRepository(sql);
    const uid = await newUser('expiry@example.com');
    await sql`INSERT INTO user_plans (user_id, plan, source, expires_at)
      VALUES (${uid}, 'pro', 'payment', ${new Date('2026-11-20T00:00:00Z')})`;
    const starts = Object.fromEntries(
      ['translation_ms', 'cloud_stt_ms', 'debriefs', 'assist_daily', 'agent_messages'].map((m) => [
        m,
        start,
      ]),
    ) as Parameters<typeof repo.snapshot>[1];
    const before = new Date('2026-11-19T23:59:59Z');
    const at = new Date('2026-11-20T00:00:00Z');
    expect((await repo.snapshot(uid, starts, before)).plan).toBe('pro');
    expect((await repo.gate(uid, 'debriefs', start, before)).plan).toBe('pro');
    expect((await repo.snapshot(uid, starts, at)).plan).toBe('free');
    expect((await repo.gate(uid, 'debriefs', start, at)).plan).toBe('free');
    await sql`UPDATE user_plans SET plan = 'ultra', source = 'manual', expires_at = NULL WHERE user_id = ${uid}`;
    const [row] = await sql`SELECT source, expires_at FROM user_plans WHERE user_id = ${uid}`;
    expect(row).toMatchObject({ source: 'manual', expires_at: null });
    expect((await repo.gate(uid, 'debriefs', start, at)).plan).toBe('ultra');
  });

  it('reads the gate and writes a counter in about a millisecond each (rough latency, informational)', async () => {
    const repo = createPostgresUsageRepository(sql);
    const uid = await newUser('timing@example.com');
    const rounds = 200;
    for (let i = 0; i < 20; i += 1) await repo.gate(uid, 'translation_ms', start, NOW); // warm-up
    const time = async (work: () => Promise<unknown>) => {
      const samples: number[] = [];
      for (let i = 0; i < rounds; i += 1) {
        const t0 = performance.now();
        await work();
        samples.push(performance.now() - t0);
      }
      samples.sort((a, b) => a - b);
      return { p50: samples[Math.floor(rounds * 0.5)]!, p95: samples[Math.floor(rounds * 0.95)]! };
    };
    const gate = await time(() => repo.gate(uid, 'translation_ms', start, NOW));
    const add = await time(() => repo.add(uid, 'translation_ms', start, 900));
    // eslint-disable-next-line no-console
    console.info(
      `usage latency (ms): gate p50 ${gate.p50.toFixed(2)} p95 ${gate.p95.toFixed(2)}; ` +
        `add p50 ${add.p50.toFixed(2)} p95 ${add.p95.toFixed(2)}`,
    );
    expect(gate.p95).toBeLessThan(50);
    expect(add.p95).toBeLessThan(50);
  });
});
