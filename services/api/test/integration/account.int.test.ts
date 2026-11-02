import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSql } from '../../src/lib/db';
import { createPostgresAccountRepository } from '../../src/modules/account';
import { startMigratedPostgres, type TestDatabase } from './postgres';

/** Account on real Postgres: rename, and closing really removes the person and what hangs off them. */
describe('account on real Postgres', () => {
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

  it('reads and renames only the given user', async () => {
    const repo = createPostgresAccountRepository(sql);
    const [a, b] = await sql<{ id: string }[]>`
      INSERT INTO auth_user (name, email) VALUES ('Alice', 'a@test.dev'), ('Bob', 'b@test.dev') RETURNING id`;

    expect((await repo.get(a!.id))?.email).toBe('a@test.dev');
    expect((await repo.updateName(a!.id, 'Alice Nguyen'))?.name).toBe('Alice Nguyen');
    expect((await repo.get(b!.id))?.name).toBe('Bob');
  });

  it('removes the account together with their meetings, devices and profile', async () => {
    const repo = createPostgresAccountRepository(sql);
    const [user] = await sql<{ id: string }[]>`
      INSERT INTO auth_user (name, email) VALUES ('Carol', 'c@test.dev') RETURNING id`;
    await sql`INSERT INTO learner_profiles (user_id) VALUES (${user!.id})`;
    await sql`INSERT INTO sessions (user_id, assist_level) VALUES (${user!.id}, 4)`;
    await sql`INSERT INTO device_tokens (user_id, token_hash) VALUES (${user!.id}, 'hash-c')`;

    expect(await repo.delete(user!.id)).toBe(true);
    for (const table of ['learner_profiles', 'sessions', 'device_tokens']) {
      const [row] = await sql<{ count: string }[]>`
        SELECT count(*)::text AS count FROM ${sql(table)} WHERE user_id = ${user!.id}`;
      expect(row?.count, table).toBe('0');
    }
    expect(await repo.get(user!.id)).toBeNull();
    expect(await repo.delete(user!.id)).toBe(false);
  });
});
