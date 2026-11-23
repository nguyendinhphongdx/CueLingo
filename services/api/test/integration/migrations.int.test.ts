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
  'learning_goals',
  'lesson_contents',
  'goal_lessons',
  'lesson_reports',
];

/** Created by the plans and usage migration and the billing one after it; every deeper rollback drops both. */
const PLANS_TABLES: string[] = ['user_plans', 'usage_counters', 'billing_orders'];
/** Created by the goal lessons migration, the newest one. */
const GOAL_TABLES: string[] = [
  'learning_goals',
  'lesson_contents',
  'goal_lessons',
  'lesson_reports',
];
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

  // Counts below are "migrations back from admin_grants"; newer ones (feedback kind 'other', goal lessons) sit on top.
  const NEWER_MIGRATIONS = 2;
  const rollback = (times: number) => {
    for (let i = 0; i < times + NEWER_MIGRATIONS; i += 1) dbmate(db.url, 'rollback');
  };
  const up = (times: number) => {
    for (let i = 0; i < times + NEWER_MIGRATIONS; i += 1) dbmate(db.url, 'up');
  };

  it('widens the feedback kind check to "other" and rolls back by removing those rows', async () => {
    const [user] = await sql<{ id: string }[]>`
      INSERT INTO auth_user (name, email) VALUES ('F', 'feedback-kind@example.com') RETURNING id`;
    await sql`INSERT INTO feedback (user_id, kind, message, client, app_version, os) VALUES (${user!.id}, 'other', 'hello', 'web', '0.0.0', 'test')`;
    // The goal lessons migration sits on top of this one: roll both back, then apply both again.
    dbmate(db.url, 'rollback');
    dbmate(db.url, 'rollback');
    expect(await sql`SELECT 1 FROM feedback WHERE kind = 'other'`).toHaveLength(0);
    await expect(
      sql`INSERT INTO feedback (user_id, kind, message, client, app_version, os) VALUES (${user!.id}, 'other', 'again', 'web', '0.0.0', 'test')`,
    ).rejects.toThrow();
    dbmate(db.url, 'up');
    dbmate(db.url, 'up');
    await sql`INSERT INTO feedback (user_id, kind, message, client, app_version, os) VALUES (${user!.id}, 'other', 'again', 'web', '0.0.0', 'test')`;
    await sql`DELETE FROM auth_user WHERE id = ${user!.id}`;
  });

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
      EXPECTED_TABLES.filter(
        (table) => !PLANS_TABLES.includes(table) && !GOAL_TABLES.includes(table),
      ).sort(),
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
    // The goal lesson tables were rolled back with it, and are back after `up` below.
    expect(await tables()).toHaveLength(
      EXPECTED_TABLES.length - PLANS_TABLES.length - GOAL_TABLES.length,
    );
    up(4);
    expect(await streamingIndex()).toEqual(['agent_messages_streaming_idx']);
  });

  it('rolls the agent conversations migration back too', async () => {
    expect(await speakerIndexes()).toEqual(['segments_speaker_idx', 'speakers_session_label_idx']);
    expect(await eventsIndex()).toEqual(['events_type_user_at_idx']);
    rollback(5);
    expect((await tables()).sort()).toEqual(
      EXPECTED_TABLES.filter(
        (table) =>
          !PLANS_TABLES.includes(table) &&
          !LATEST_TABLES.includes(table) &&
          !GOAL_TABLES.includes(table),
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
          !FEEDBACK_TABLES.includes(table) &&
          !GOAL_TABLES.includes(table),
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

  const metricRule = async () =>
    (
      await sql<{ def: string }[]>`
        SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid = 'usage_counters'::regclass AND conname = 'usage_counters_metric_check'`
    )[0]?.def;

  it('adds the goal lesson tables and metrics, and rolls them back', async () => {
    expect(await tables()).toEqual(expect.arrayContaining(GOAL_TABLES));
    expect(await metricRule()).toContain('lesson_practice_daily');
    const [user] = await sql<{ id: string }[]>`
      INSERT INTO auth_user (name, email) VALUES ('G', 'goal-migration@example.com') RETURNING id`;
    await sql`INSERT INTO usage_counters (user_id, period_start, metric, amount)
      VALUES (${user!.id}, now(), 'lessons_daily', 1)`;
    // The shared content table has no user column: nothing personal can be put in it.
    const columns = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'lesson_contents'`;
    expect(columns.map((c) => c.column_name)).not.toContain('user_id');

    dbmate(db.url, 'rollback');
    expect(await tables()).not.toContain('lesson_contents');
    expect(await metricRule()).not.toContain('lessons_daily');
    expect(await sql`SELECT 1 FROM usage_counters WHERE metric = 'lessons_daily'`).toHaveLength(0);
    dbmate(db.url, 'up');
    expect((await tables()).sort()).toEqual([...EXPECTED_TABLES].sort());
    expect(await metricRule()).toContain('lessons_daily');
    await sql`DELETE FROM auth_user WHERE id = ${user!.id}`;
  });
});
