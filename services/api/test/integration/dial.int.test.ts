import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSql } from '../../src/lib/db';
import { createPostgresDialRepository } from '../../src/modules/dial';
import { startMigratedPostgres, type TestDatabase } from './postgres';

/** The facts behind the assist suggestion, read from real tables. */
describe('assist suggestion facts on real Postgres', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = createSql(db.url);
  }, 120_000);

  afterAll(async () => {
    await sql?.end();
    await db?.stop();
  });

  it('reads the level, recent meetings with their latest debrief and lookups, and the last answer', async () => {
    const repo = createPostgresDialRepository(sql);
    const [user] = await sql<{ id: string }[]>`
      INSERT INTO auth_user (name, email) VALUES ('Dana', 'd@test.dev') RETURNING id`;
    await sql`INSERT INTO learner_profiles (user_id, assist_default) VALUES (${user!.id}, 3)`;
    await sql`INSERT INTO learner_languages (user_id, language, assist_default) VALUES (${user!.id}, 'en', 3)`;

    const base = Date.now();
    const ids: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const [row] = await sql<{ id: string }[]>`
        INSERT INTO sessions (user_id, assist_level, started_at, status)
        VALUES (${user!.id}, 3, ${new Date(base - i * 86_400_000)}, 'debriefed') RETURNING id`;
      ids.push(row!.id);
      // Two versions: the newer one counts.
      await sql`
        INSERT INTO debriefs (session_id, version, summary, comprehension_pct, prompt_version)
        VALUES (${row!.id}, 1, '{}', 10, 'v1'), (${row!.id}, 2, '{}', ${80 + i}, 'v1')`;
      for (let l = 0; l <= i; l += 1) {
        await sql`
          INSERT INTO events (id, user_id, session_id, type, at)
          VALUES (gen_random_uuid(), ${user!.id}, ${row!.id}, 'lookup', now())`;
      }
    }
    await sql`
      INSERT INTO events (id, user_id, type, payload, at)
      VALUES (gen_random_uuid(), ${user!.id}, 'assist_suggestion', '{"action":"dismissed","level":3}', ${new Date(base - 5000)})`;

    const facts = await repo.facts(user!.id, 'en');
    expect(facts.currentLevel).toBe(3);
    expect(facts.meetings.map((meeting) => meeting.comprehensionPct)).toEqual([80, 81, 82]);
    expect(facts.meetings.map((meeting) => meeting.lookups)).toEqual([1, 2, 3]);
    expect(facts.lastDecisionAt).not.toBeNull();
  });

  it('keeps a level, meetings and answers apart for each language', async () => {
    const repo = createPostgresDialRepository(sql);
    const [user] = await sql<{ id: string }[]>`
      INSERT INTO auth_user (name, email) VALUES ('Jun', 'j@test.dev') RETURNING id`;
    await sql`INSERT INTO learner_languages (user_id, language, assist_default) VALUES (${user!.id}, 'en', 0), (${user!.id}, 'ja', 4)`;
    await sql`INSERT INTO sessions (user_id, assist_level, language) VALUES (${user!.id}, 4, 'ja')`;
    await sql`
      INSERT INTO events (id, user_id, type, payload, at)
      VALUES (gen_random_uuid(), ${user!.id}, 'assist_suggestion', '{"action":"applied","level":0,"language":"ja"}', now())`;

    const japanese = await repo.facts(user!.id, 'ja');
    expect(japanese.currentLevel).toBe(4);
    expect(japanese.meetings).toHaveLength(1);
    expect(japanese.lastDecisionAt).not.toBeNull();

    const english = await repo.facts(user!.id, 'en');
    expect(english.currentLevel).toBe(0);
    expect(english.meetings).toHaveLength(0);
    expect(english.lastDecisionAt).toBeNull();
  });

  it('defaults to full help for someone with no profile, and sees nobody else', async () => {
    const repo = createPostgresDialRepository(sql);
    const [other] = await sql<{ id: string }[]>`
      INSERT INTO auth_user (name, email) VALUES ('Eli', 'e@test.dev') RETURNING id`;
    expect(await repo.facts(other!.id, 'en')).toEqual({
      currentLevel: 4,
      meetings: [],
      lastDecisionAt: null,
    });
  });
});
