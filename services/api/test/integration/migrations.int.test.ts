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
  'user_plans',
  'usage_counters',
  'billing_orders',
];

/** Created by the plans and usage migration and the billing one after it; every deeper rollback drops both. */
const PLANS_TABLES: string[] = ['user_plans', 'usage_counters', 'billing_orders'];
/** Created by the agent conversations migration (a later one only adds an index). */
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

  const debriefSkippedColumn = async () =>
    (
      await sql<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'sessions' AND column_name = 'debrief_skipped'`
    ).map((r) => r.column_name);

  const planColumns = async () =>
    (
      await sql<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'user_plans' AND column_name IN ('expires_at', 'source')`
    )
      .map((r) => r.column_name)
      .sort();

  const amountRule = async () =>
    (
      await sql<{ def: string }[]>`
        SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid = 'billing_orders'::regclass AND conname = 'billing_orders_amount_check'`
    )[0]?.def;

  it('allows a 0 dong admin order, and rolls back by removing it', async () => {
    expect(await amountRule()).toContain('>= 0');
    const [user] = await sql<{ id: string }[]>`
      INSERT INTO auth_user (name, email) VALUES ('T', 'grant@example.com') RETURNING id`;
    await sql`INSERT INTO billing_orders (user_id, order_code, provider, plan, period, amount, status, expires_at, paid_at)
      VALUES (${user!.id}, nextval('billing_order_code_seq'), 'admin', 'pro', 'month', 0, 'paid', now(), now())`;
    expect(await sql`SELECT 1 FROM billing_orders`).toHaveLength(1);
    await expect(
      sql`INSERT INTO billing_orders (user_id, order_code, provider, plan, period, amount, expires_at)
        VALUES (${user!.id}, nextval('billing_order_code_seq'), 'admin', 'pro', 'month', -1, now())`,
    ).rejects.toThrow();
    rollback(1);
    expect(await amountRule()).toContain('> 0');
    expect(await sql`SELECT 1 FROM billing_orders`).toHaveLength(0);
    up(1);
    expect(await amountRule()).toContain('>= 0');
    await sql`DELETE FROM auth_user WHERE id = ${user!.id}`;
  });

  it('rolls the billing migration back and applies it again', async () => {
    expect(await planColumns()).toEqual(['expires_at', 'source']);
    rollback(2);
    expect(await tables()).not.toContain('billing_orders');
    expect(await tables()).toContain('user_plans');
    expect(await planColumns()).toEqual([]);
    up(2);
    expect((await tables()).sort()).toEqual([...EXPECTED_TABLES].sort());
    expect(await planColumns()).toEqual(['expires_at', 'source']);
  });

  it('rolls the plans and usage migration back and applies it again', async () => {
    expect(await debriefSkippedColumn()).toEqual(['debrief_skipped']);
    rollback(3);
    expect((await tables()).sort()).toEqual(
      EXPECTED_TABLES.filter((table) => !PLANS_TABLES.includes(table)).sort(),
    );
    expect(await debriefSkippedColumn()).toEqual([]);
    up(3);
    expect((await tables()).sort()).toEqual([...EXPECTED_TABLES].sort());
    expect(await debriefSkippedColumn()).toEqual(['debrief_skipped']);
  });

  it('rolls the streaming index migration back and applies it again', async () => {
    expect(await streamingIndex()).toEqual(['agent_messages_streaming_idx']);
    rollback(4);
    expect(await streamingIndex()).toEqual([]);
    // The migrations before it are untouched.
    expect(await tables()).toHaveLength(EXPECTED_TABLES.length - PLANS_TABLES.length);
    up(4);
    expect(await streamingIndex()).toEqual(['agent_messages_streaming_idx']);
  });

  it('rolls the agent conversations migration back too', async () => {
    expect(await speakerIndexes()).toEqual(['segments_speaker_idx', 'speakers_session_label_idx']);
    expect(await eventsIndex()).toEqual(['events_type_user_at_idx']);
    rollback(5);
    expect((await tables()).sort()).toEqual(
      EXPECTED_TABLES.filter(
        (table) => !PLANS_TABLES.includes(table) && !LATEST_TABLES.includes(table),
      ).sort(),
    );
    expect(await eventsIndex()).toEqual(['events_type_user_at_idx']);
    expect(await speakerIndexes()).toEqual(['segments_speaker_idx', 'speakers_session_label_idx']);
    up(5);
    expect(await tables()).toHaveLength(EXPECTED_TABLES.length);
  });

  it('rolls the feedback migration back too', async () => {
    rollback(6);
    expect((await tables()).sort()).toEqual(
      EXPECTED_TABLES.filter(
        (table) =>
          !PLANS_TABLES.includes(table) &&
          !LATEST_TABLES.includes(table) &&
          !FEEDBACK_TABLES.includes(table),
      ).sort(),
    );
    expect(await eventsIndex()).toEqual([]);
    up(6);
    expect(await tables()).toHaveLength(EXPECTED_TABLES.length);
    expect(await eventsIndex()).toEqual(['events_type_user_at_idx']);
  });

  it('rolls the invites migration back too', async () => {
    rollback(7);
    expect(await tables()).not.toContain('invites');
    expect(await tables()).not.toContain('invite_redemptions');
    up(7);
    expect(await tables()).toHaveLength(EXPECTED_TABLES.length);
  });
});
