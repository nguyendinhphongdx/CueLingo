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
    const snap = await repo.snapshot(alice, {
      translation_ms: start,
      cloud_stt_ms: start,
      debriefs: start,
      assist_daily: start,
      agent_messages: start,
    });
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
    const snap = await repo.snapshot(bob, starts);
    expect(snap.amounts.translation_ms).toBe(1500);
    expect(snap.amounts.assist_daily).toBe(0);
    expect((await repo.snapshot(alice, starts)).amounts.translation_ms).toBe(0);
  });

  it('sets a plan, finds a user by email ignoring case, and cascades with the account', async () => {
    const repo = createPostgresUsageRepository(sql);
    expect(await repo.userIdByEmail('ALICE@example.com')).toBe(alice);
    expect(await repo.userIdByEmail('nobody@example.com')).toBeNull();
    await repo.setPlan(alice, 'pro', bob);
    await repo.setPlan(alice, 'ultra', bob);
    const [row] = await sql`SELECT plan, set_by FROM user_plans WHERE user_id = ${alice}`;
    expect(row).toMatchObject({ plan: 'ultra', set_by: bob });
    await sql`DELETE FROM auth_user WHERE id = ${alice}`;
    expect(await sql`SELECT 1 FROM usage_counters WHERE user_id = ${alice}`).toHaveLength(0);
    expect(await sql`SELECT 1 FROM user_plans WHERE user_id = ${alice}`).toHaveLength(0);
  });
});
