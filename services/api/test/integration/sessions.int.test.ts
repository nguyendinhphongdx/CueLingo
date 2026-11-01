import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPostgresSessionsRepository } from '../../src/modules/sessions';
import { startMigratedPostgres, type TestDatabase } from './postgres';

describe('sessions on real Postgres (AC7)', () => {
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
    alice = await newUser('sessions-alice@example.com');
    bob = await newUser('sessions-bob@example.com');
  });
  afterAll(async () => {
    await sql.end();
    await db.stop();
  });

  it('keeps sessions, details, ending and segments within the owning user', async () => {
    const repo = createPostgresSessionsRepository(sql);
    const session = await repo.create(alice, { title: 'Private meeting', assistLevel: 3 });

    expect(await repo.findById(bob, session.id)).toBeNull();
    expect(await repo.findDetail(bob, session.id)).toBeNull();
    expect(await repo.end(bob, session.id)).toBeNull();
    expect(
      await repo.saveSegment({
        sessionId: session.id,
        userId: bob,
        segmentId: 'c67ef96d-7890-49a7-9a55-66c49272e38f',
        source: 'system',
        startMs: 0,
        endMs: 900,
        textEn: 'Secret',
      }),
    ).toBe(false);
    expect(await repo.list(bob)).toEqual([]);
    expect((await repo.findById(alice, session.id))?.status).toBe('live');
  });
});
