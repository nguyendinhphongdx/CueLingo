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
  'invites',
  'invite_redemptions',
  'feedback',
  'agent_conversations',
  'agent_messages',
];

/** Created by the agent conversations migration (the latest one only adds an index). */
const LATEST_TABLES: string[] = ['agent_conversations', 'agent_messages'];
/** Created by the migration before it (feedback + events index). */
const FEEDBACK_TABLES: string[] = ['feedback'];

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

  const eventsIndex = async () =>
    (
      await sql<{ indexname: string }[]>`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'events_type_user_at_idx'`
    ).map((r) => r.indexname);

  const streamingIndex = async () =>
    (
      await sql<{ indexname: string }[]>`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'agent_messages_streaming_idx'`
    ).map((r) => r.indexname);

  const rollback = (times: number) => {
    for (let i = 0; i < times; i += 1) dbmate(db.url, 'rollback');
  };
  const up = (times: number) => {
    for (let i = 0; i < times; i += 1) dbmate(db.url, 'up');
  };

  it('rolls the last migration (streaming index) back and applies it again', async () => {
    expect(await streamingIndex()).toEqual(['agent_messages_streaming_idx']);
    rollback(1);
    expect(await streamingIndex()).toEqual([]);
    // The migrations before it are untouched.
    expect(await tables()).toHaveLength(EXPECTED_TABLES.length);
    up(1);
    expect(await streamingIndex()).toEqual(['agent_messages_streaming_idx']);
  });

  it('rolls the agent conversations migration back too', async () => {
    expect(await speakerIndexes()).toEqual(['segments_speaker_idx', 'speakers_session_label_idx']);
    expect(await eventsIndex()).toEqual(['events_type_user_at_idx']);
    rollback(2);
    expect((await tables()).sort()).toEqual(
      EXPECTED_TABLES.filter((table) => !LATEST_TABLES.includes(table)).sort(),
    );
    expect(await eventsIndex()).toEqual(['events_type_user_at_idx']);
    expect(await speakerIndexes()).toEqual(['segments_speaker_idx', 'speakers_session_label_idx']);
    up(2);
    expect(await tables()).toHaveLength(EXPECTED_TABLES.length);
  });

  it('rolls the feedback migration back too', async () => {
    rollback(3);
    expect((await tables()).sort()).toEqual(
      EXPECTED_TABLES.filter(
        (table) => !LATEST_TABLES.includes(table) && !FEEDBACK_TABLES.includes(table),
      ).sort(),
    );
    expect(await eventsIndex()).toEqual([]);
    up(3);
    expect(await tables()).toHaveLength(EXPECTED_TABLES.length);
    expect(await eventsIndex()).toEqual(['events_type_user_at_idx']);
  });

  it('rolls the invites migration back too', async () => {
    rollback(4);
    expect(await tables()).not.toContain('invites');
    expect(await tables()).not.toContain('invite_redemptions');
    up(4);
    expect(await tables()).toHaveLength(EXPECTED_TABLES.length);
  });
});
