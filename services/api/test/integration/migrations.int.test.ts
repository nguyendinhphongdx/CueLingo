import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { dbmate, startPostgres, type TestDatabase } from './postgres';

const EXPECTED_TABLES = [
  'auth_user',
  'auth_session',
  'auth_account',
  'auth_verification',
  'learner_profiles',
  'sessions',
  'speakers',
  'segments',
  'events',
  'glossary_terms',
  'lexical_items',
  'user_lexicon',
  'debriefs',
  'review_logs',
  'device_codes',
  'device_tokens',
  'learner_languages',
];

/** Created by the latest migration (speaker labels only add constraints and indexes, no table). */
const LATEST_TABLES: string[] = [];

describe('migrations (AC2)', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;

  const tables = async () =>
    (
      await sql<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name <> 'schema_migrations'`
    ).map((r) => r.table_name);

  beforeAll(async () => {
    db = await startPostgres();
    sql = postgres(db.url);
  });
  afterAll(async () => {
    await sql.end();
    await db.stop();
  });

  it('creates every table on an empty database', async () => {
    dbmate(db.url, 'up');
    expect((await tables()).sort()).toEqual([...EXPECTED_TABLES].sort());
  });

  const speakerIndexes = async () =>
    (
      await sql<{ indexname: string }[]>`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND indexname IN ('speakers_session_label_idx', 'segments_speaker_idx')`
    )
      .map((r) => r.indexname)
      .sort();

  it('rolls the last migration back and applies it again', async () => {
    expect(await speakerIndexes()).toEqual(['segments_speaker_idx', 'speakers_session_label_idx']);
    dbmate(db.url, 'rollback');
    expect((await tables()).sort()).toEqual(
      EXPECTED_TABLES.filter((table) => !LATEST_TABLES.includes(table)).sort(),
    );
    expect(await speakerIndexes()).toEqual([]);
    dbmate(db.url, 'up');
    expect(await tables()).toHaveLength(EXPECTED_TABLES.length);
    expect(await speakerIndexes()).toEqual(['segments_speaker_idx', 'speakers_session_label_idx']);
  });
});
