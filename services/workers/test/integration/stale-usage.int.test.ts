import { resolvePlanLimits } from '@cuelingo/shared';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPostgresStaleSessionsRepository } from '../../src/jobs/stale-sessions';
import { createPostgresDebriefAllowance } from '../../src/lib/usage';
import { startMigratedPostgres, type TestDatabase } from './postgres';

/** The worker repeats the API's reservation SQL; it must agree with the API on who gets a debrief. */
describe('stale-sessions debrief allowance on real Postgres', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  const now = new Date('2026-11-14T05:00:00Z');
  const user = async (email: string) =>
    (
      await sql<{ id: string }[]>`
        INSERT INTO auth_user (name, email) VALUES (${email}, ${email}) RETURNING id`
    )[0]!.id;

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
  });
  afterAll(async () => {
    await sql.end();
    await db.stop();
  });

  it('grants the monthly debriefs of the plan, then refuses, and never refuses an admin', async () => {
    const allowance = createPostgresDebriefAllowance(sql, {
      limits: resolvePlanLimits({ free: { debriefs: 2 } }),
      adminEmails: ['owner@example.com'],
      now: () => now,
    });
    const alice = await user('alice@example.com');
    const bob = await user('bob@example.com');
    const owner = await user('owner@example.com');

    const grants = await Promise.all(
      Array.from({ length: 5 }, () => allowance.reserveDebrief(alice)),
    );
    expect(grants.filter(Boolean)).toHaveLength(2);
    expect(await allowance.reserveDebrief(bob)).toBe(true);
    for (let i = 0; i < 4; i += 1) expect(await allowance.reserveDebrief(owner)).toBe(true);

    await sql`INSERT INTO user_plans (user_id, plan) VALUES (${alice}, 'pro')`;
    expect(await allowance.reserveDebrief(alice)).toBe(true);
  });

  it('records the skip flag on the session and returns the owner of a closed session', async () => {
    const owner = await user('stale@example.com');
    const [session] = await sql<{ id: string }[]>`
      INSERT INTO sessions (user_id, assist_level, started_at)
      VALUES (${owner}, 4, now() - interval '3 hours') RETURNING id`;
    await sql`INSERT INTO segments (session_id, source, start_ms, end_ms, text_en)
      VALUES (${session!.id}, 'system', 0, 1000, 'hello')`;
    const repo = createPostgresStaleSessionsRepository(sql);
    const closed = await repo.closeStaleLive(new Date(Date.now() - 30 * 60_000), 10);
    expect(closed).toEqual([{ id: session!.id, userId: owner, segmentCount: 1 }]);
    // Only the owner's id marks the session.
    await repo.markDebriefSkipped(await user('other@example.com'), session!.id);
    expect(
      (await sql`SELECT debrief_skipped FROM sessions WHERE id = ${session!.id}`)[0]!
        .debrief_skipped,
    ).toBeNull();
    await repo.markDebriefSkipped(owner, session!.id);
    const [row] = await sql`SELECT debrief_skipped FROM sessions WHERE id = ${session!.id}`;
    expect(row!.debrief_skipped).toBe('quota');
  });
});
