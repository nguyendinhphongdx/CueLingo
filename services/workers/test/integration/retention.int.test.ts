import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AUDIO_RETENTION_DAYS,
  createPostgresRetentionRepository,
  sweepExpiredAudio,
} from '../../src/jobs/retention';
import { startMigratedPostgres, type TestDatabase } from './postgres';

/** The real SQL behind retention.sweep: expired audio keys are found, forgotten, and nothing else is touched. */
describe('retention.sweep on real Postgres', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  const deleted: string[] = [];
  const now = new Date();

  const seedSegment = async (userId: string, key: string | null, startedDaysAgo: number) => {
    const [meeting] = await sql<{ id: string }[]>`
      INSERT INTO sessions (user_id, assist_level, started_at)
      VALUES (${userId}, 4, now() - make_interval(days => ${startedDaysAgo})) RETURNING id`;
    await sql`
      INSERT INTO segments (session_id, source, start_ms, end_ms, text_en, audio_key)
      VALUES (${meeting!.id}, 'system', 0, 1000, 'hello', ${key})`;
  };
  const keys = async () =>
    (
      await sql<
        { audio_key: string | null }[]
      >`SELECT audio_key FROM segments ORDER BY text_en, audio_key`
    ).map((r) => r.audio_key);

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
    const [user] = await sql<
      { id: string }[]
    >`INSERT INTO auth_user (name, email) VALUES ('u', 'u@example.com') RETURNING id`;
    await seedSegment(user!.id, 'audio/old', AUDIO_RETENTION_DAYS + 5);
    await seedSegment(user!.id, 'audio/recent', AUDIO_RETENTION_DAYS - 5);
    await seedSegment(user!.id, null, 90);
  });
  afterAll(async () => {
    await sql.end();
    await db.stop();
  });

  it('forgets only expired keys and deletes exactly those objects', async () => {
    const deps = {
      retention: createPostgresRetentionRepository(sql),
      storage: { deleteMany: async (k: string[]) => void deleted.push(...k) },
      now: () => now,
    };

    const first = await sweepExpiredAudio(deps);

    expect(first.removed).toBe(1);
    expect(deleted).toEqual(['audio/old']);
    const after = await keys();
    expect(after).toHaveLength(3);
    expect(after.filter((k) => k !== null)).toEqual(['audio/recent']);
  });

  it('is idempotent on the real database', async () => {
    const result = await sweepExpiredAudio({
      retention: createPostgresRetentionRepository(sql),
      storage: { deleteMany: async () => {} },
      now: () => now,
    });
    expect(result.removed).toBe(0);
  });
});
