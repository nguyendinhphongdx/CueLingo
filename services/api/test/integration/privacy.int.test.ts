import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPostgresPrivacyRepository } from '../../src/modules/privacy';
import { startMigratedPostgres, type TestDatabase } from './postgres';

describe('privacy on real Postgres (AC3, AC4)', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
    alice = (
      await sql<{ id: string }[]>`
        INSERT INTO auth_user (name, email) VALUES ('Alice', 'privacy-alice@example.com') RETURNING id`
    )[0]!.id;
    bob = (
      await sql<{ id: string }[]>`
        INSERT INTO auth_user (name, email) VALUES ('Bob', 'privacy-bob@example.com') RETURNING id`
    )[0]!.id;
  });
  afterAll(async () => {
    await sql.end();
    await db.stop();
  });

  async function seedUser(userId: string, label: string) {
    const [session] = await sql<{ id: string }[]>`
      INSERT INTO sessions (user_id, title, assist_level, status, ended_at)
      VALUES (${userId}, ${`${label} meeting`}, 3, 'debriefed', now()) RETURNING id`;
    const [segment] = await sql<{ id: string }[]>`
      INSERT INTO segments (session_id, source, start_ms, end_ms, text_en, text_vi)
      VALUES (${session!.id}, 'system', 0, 1000, ${`${label} transcript`}, 'Bản dịch')
      RETURNING id`;
    await sql`
      INSERT INTO debriefs (session_id, summary, prompt_version)
      VALUES (${session!.id}, ${sql.json({ headlineVi: `${label} debrief`, bulletsVi: [] })}, 'v1')`;
    await sql`
      INSERT INTO events (id, user_id, session_id, segment_id, type, at)
      VALUES (gen_random_uuid(), ${userId}, ${session!.id}, ${segment!.id}, 'lookup', now())`;
    await sql`
      INSERT INTO glossary_terms (user_id, term, translation)
      VALUES (${userId}, ${`${label} term`}, 'nghĩa')`;
    const [item] = await sql<{ id: string }[]>`
      INSERT INTO lexical_items (lemma, type) VALUES (${`${label} phrase`}, 'phrase') RETURNING id`;
    await sql`
      INSERT INTO user_lexicon (user_id, item_id, first_context_segment_id, meaning_vi, in_review)
      VALUES (${userId}, ${item!.id}, ${segment!.id}, 'nghĩa', true)`;
    await sql`
      INSERT INTO review_logs (user_id, item_id, exercise_type, rating)
      VALUES (${userId}, ${item!.id}, 'recognize', 3)`;
    return { sessionId: session!.id };
  }

  it('exports only owned meetings, segments, debriefs, phrases and terms', async () => {
    const aliceData = await seedUser(alice, 'Alice');
    await seedUser(bob, 'Bob');
    const repo = createPostgresPrivacyRepository(sql);

    const exported = await repo.exportMyData(alice, new Date('2026-11-06T09:00:00.000Z'));

    expect(exported.exportedAt).toBe('2026-11-06T09:00:00.000Z');
    expect(exported.sessions).toHaveLength(1);
    expect(exported.sessions[0]).toMatchObject({ id: aliceData.sessionId, title: 'Alice meeting' });
    expect(exported.sessions[0]?.segments[0]?.textEn).toBe('Alice transcript');
    expect(exported.sessions[0]?.debrief?.summary.headlineVi).toBe('Alice debrief');
    expect(exported.phrases.map((phrase) => phrase.phrase)).toEqual(['Alice phrase']);
    expect(exported.glossaryTerms.map((term) => term.term)).toEqual(['Alice term']);
    expect(JSON.stringify(exported)).not.toContain('Bob');
  });

  it('hard-deletes every owned data table in one user scope and preserves accounts and other users', async () => {
    const repo = createPostgresPrivacyRepository(sql);
    await repo.deleteMyData(alice);

    for (const table of ['sessions', 'events', 'glossary_terms', 'user_lexicon', 'review_logs']) {
      const [aliceCount] = await sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM ${sql(table)} WHERE user_id = ${alice}`;
      const [bobCount] = await sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM ${sql(table)} WHERE user_id = ${bob}`;
      expect(aliceCount?.count, table).toBe(0);
      expect(bobCount?.count, table).toBeGreaterThan(0);
    }
    const [aliceUser] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM auth_user WHERE id = ${alice}`;
    expect(aliceUser?.count).toBe(1);
    expect((await sql`SELECT * FROM segments WHERE text_en = 'Alice transcript'`).length).toBe(0);
    expect(
      (await sql`SELECT * FROM debriefs WHERE summary->>'headlineVi' = 'Alice debrief'`).length,
    ).toBe(0);
  });
});
