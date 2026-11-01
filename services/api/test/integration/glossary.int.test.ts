import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { createPostgresGlossaryRepository } from '../../src/modules/glossary';
import { buildTestApp, TEST_USER_HEADER } from '../../src/testing';
import { startMigratedPostgres, type TestDatabase } from './postgres';

/** AC5: the real repository keeps one user's glossary invisible to another. */
describe('glossary on real Postgres (AC5)', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  let alice: string;
  let bob: string;

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

  it('stores terms per user and enforces uniqueness case-insensitively', async () => {
    const repo = createPostgresGlossaryRepository(sql);
    const created = await repo.create(alice, {
      term: 'Sprint Review',
      translation: null,
      note: null,
    });
    expect(created.term).toBe('Sprint Review');
    expect((await repo.findByTerm(alice, 'sprint review'))?.id).toBe(created.id);
    await expect(
      repo.create(alice, { term: 'SPRINT REVIEW', translation: null, note: null }),
    ).rejects.toThrow();
  });

  it("never exposes, updates or deletes another user's term", async () => {
    const repo = createPostgresGlossaryRepository(sql);
    const mine = await repo.create(alice, { term: 'Roadmap', translation: null, note: null });

    expect(await repo.list(bob)).toEqual([]);
    expect(await repo.findById(bob, mine.id)).toBeNull();
    expect(await repo.update(bob, mine.id, { note: 'hijack' })).toBeNull();
    expect(await repo.delete(bob, mine.id)).toBe(false);
    expect((await repo.findById(alice, mine.id))?.note).toBeNull();
  });

  it('holds through the HTTP layer', async () => {
    const app = await buildTestApp({ repos: { glossary: createPostgresGlossaryRepository(sql) } });
    const created = await app.inject({
      method: 'POST',
      url: '/v1/glossary',
      headers: { [TEST_USER_HEADER]: alice },
      payload: { term: 'Standup' },
    });
    expect(created.statusCode).toBe(201);
    const asBob = await app.inject({
      method: 'GET',
      url: '/v1/glossary',
      headers: { [TEST_USER_HEADER]: bob },
    });
    expect(asBob.json().items).toEqual([]);
    await app.close();
  });
});
