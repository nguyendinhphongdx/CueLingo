import { createHash } from 'node:crypto';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSql } from '../../src/lib/db';
import { createPostgresDeviceRepository } from '../../src/modules/device';
import { startMigratedPostgres, type TestDatabase } from './postgres';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

/** Device sign-in on real Postgres: codes work once, tokens revoke, and users stay apart. */
describe('device sign-in on real Postgres', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = createSql(db.url);
    const users = await sql<{ id: string }[]>`
      INSERT INTO auth_user (name, email) VALUES ('Alice', 'a@test.dev'), ('Bob', 'b@test.dev')
      RETURNING id`;
    [alice, bob] = [users[0]!.id, users[1]!.id];
  }, 120_000);

  afterAll(async () => {
    await sql?.end();
    await db?.stop();
  });

  it('consumes a code once and refuses it after expiry', async () => {
    const repo = createPostgresDeviceRepository(sql);
    const now = new Date('2026-11-05T09:00:00Z');
    await repo.createCode(alice, hash('fresh'), new Date(now.getTime() + 300_000));
    await repo.createCode(alice, hash('old'), new Date(now.getTime() - 1000));

    expect(await repo.consumeCode(hash('fresh'), now)).toBe(alice);
    expect(await repo.consumeCode(hash('fresh'), now)).toBeNull();
    expect(await repo.consumeCode(hash('old'), now)).toBeNull();
    expect(await repo.consumeCode(hash('unknown'), now)).toBeNull();
  });

  it('finds a token until it is revoked, and only the owner can revoke it by id', async () => {
    const repo = createPostgresDeviceRepository(sql);
    const now = new Date();
    await repo.createToken(alice, hash('token-a'), 'Mac');
    expect(await repo.findUserByTokenHash(hash('token-a'), now)).toBe(alice);

    const [device] = await repo.listTokens(alice);
    expect(await repo.revokeToken(bob, device!.id)).toBe(false);
    expect(await repo.listTokens(bob)).toEqual([]);
    expect(await repo.revokeToken(alice, device!.id)).toBe(true);
    expect(await repo.findUserByTokenHash(hash('token-a'), now)).toBeNull();
  });

  it('revokes by hash for sign-out', async () => {
    const repo = createPostgresDeviceRepository(sql);
    await repo.createToken(bob, hash('token-b'), null);
    expect(await repo.revokeByHash(hash('token-b'))).toBe(true);
    expect(await repo.findUserByTokenHash(hash('token-b'), new Date())).toBeNull();
  });
});
