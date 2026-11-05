import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPostgresPhrasesRepository,
  createPostgresStudyRepository,
} from '../../src/modules/review';
import { buildTestApp, TEST_USER_HEADER } from '../../src/testing';
import { startMigratedPostgres, type TestDatabase } from './postgres';

describe('phrases on real Postgres (AC1-AC3)', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let alice: string;
  let bob: string;
  let aliceSegment: string;
  let bobSegment: string;

  const newUser = async (email: string) =>
    (
      await sql<
        { id: string }[]
      >`INSERT INTO auth_user (name, email) VALUES (${email}, ${email}) RETURNING id`
    )[0]!.id;

  const newSegment = async (userId: string) => {
    const [session] = await sql<{ id: string }[]>`
      INSERT INTO sessions (user_id, assist_level) VALUES (${userId}, 4) RETURNING id`;
    const [segment] = await sql<{ id: string }[]>`
      INSERT INTO segments (session_id, source, start_ms, end_ms, text_en)
      VALUES (${session!.id}, 'system', 0, 1000, 'Circle back') RETURNING id`;
    return segment!.id;
  };

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
    alice = await newUser('phrases-alice@example.com');
    bob = await newUser('phrases-bob@example.com');
    aliceSegment = await newSegment(alice);
    bobSegment = await newSegment(bob);
    app = await buildTestApp({ repos: { phrases: createPostgresPhrasesRepository(sql) } });
  });
  afterAll(async () => {
    await app?.close();
    await sql?.end();
    await db?.stop();
  });

  const save = (userId: string, payload: object) =>
    app.inject({
      method: 'POST',
      url: '/v1/phrases',
      headers: { [TEST_USER_HEADER]: userId },
      payload,
    });

  it('upserts one normalized lexical item and the user lexicon meaning', async () => {
    const first = await save(alice, {
      phrase: 'Circle Back',
      meaningVi: 'nói lại',
      segmentId: aliceSegment,
    });
    const repeated = await save(alice, {
      phrase: '  CIRCLE   back ',
      meaningVi: 'trao đổi lại',
    });

    expect(repeated.json()).toMatchObject({ id: first.json().id, meaningVi: 'trao đổi lại' });
    const [counts] = await sql<{ items: string; entries: string }[]>`
      SELECT
        (SELECT count(*) FROM lexical_items WHERE lemma = 'circle back' AND type = 'phrase') AS items,
        (SELECT count(*) FROM user_lexicon WHERE user_id = ${alice}) AS entries`;
    expect(counts).toEqual({ items: '1', entries: '1' });
  });

  it("does not attach another user's segment or expose and delete another user's phrase", async () => {
    const created = await save(alice, { phrase: 'Follow up', segmentId: bobSegment });
    const [row] = await sql<{ first_context_segment_id: string | null }[]>`
      SELECT first_context_segment_id FROM user_lexicon
      WHERE user_id = ${alice} AND item_id = ${created.json().id}`;
    expect(row?.first_context_segment_id).toBeNull();

    const asBob = await app.inject({
      method: 'GET',
      url: '/v1/phrases',
      headers: { [TEST_USER_HEADER]: bob },
    });
    expect(asBob.json().phrases).toEqual([]);
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/v1/phrases/${created.json().id}`,
      headers: { [TEST_USER_HEADER]: bob },
    });
    expect(deleted.statusCode).toBe(404);
    expect(await createPostgresPhrasesRepository(sql).list(alice, 'en')).toContainEqual(
      created.json(),
    );
  });

  it('removes only the user lexicon row and keeps the shared lexical item', async () => {
    const created = await save(bob, { phrase: 'Follow up' });
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/v1/phrases/${created.json().id}`,
      headers: { [TEST_USER_HEADER]: bob },
    });
    expect(deleted.statusCode).toBe(204);
    const [item] = await sql<{ count: string }[]>`
      SELECT count(*) FROM lexical_items WHERE id = ${created.json().id}`;
    expect(item?.count).toBe('1');
  });

  it('stores the chat sentence as context_text and shows it as the review context (AC11)', async () => {
    const created = await save(alice, {
      phrase: 'Touch Base',
      context: 'Can we touch base on Friday?',
    });
    await save(alice, { phrase: ' touch   base ', context: 'A later sentence.' });
    const [row] = await sql<{ context_text: string | null; in_review: boolean }[]>`
      SELECT context_text, in_review FROM user_lexicon
      WHERE user_id = ${alice} AND item_id = ${created.json().id}`;
    expect(row).toEqual({ context_text: 'Can we touch base on Friday?', in_review: true });

    const items = await createPostgresStudyRepository(sql).listItems(alice, 'en');
    expect(items.find((item) => item.itemId === created.json().id)?.contextEn).toBe(
      'Can we touch base on Friday?',
    );
    // A meeting segment still wins over the saved sentence.
    const withSegment = await save(alice, {
      phrase: 'Circle Back',
      segmentId: aliceSegment,
      context: 'ignored while the segment exists',
    });
    const again = await createPostgresStudyRepository(sql).listItems(alice, 'en');
    expect(again.find((item) => item.itemId === withSegment.json().id)?.contextEn).toBe(
      'Circle back',
    );
  });
});
