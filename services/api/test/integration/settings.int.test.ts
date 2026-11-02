import { DEFAULT_USER_SETTINGS } from '@cuelingo/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { createPostgresSettingsRepository } from '../../src/modules/settings';
import { startMigratedPostgres, type TestDatabase } from './postgres';

describe('settings on real Postgres (AC3)', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
    const users = await sql<{ id: string }[]>`
      INSERT INTO auth_user (name, email)
      VALUES ('Alice', 'settings-a@test.dev'), ('Bob', 'settings-b@test.dev')
      RETURNING id`;
    alice = users[0]!.id;
    bob = users[1]!.id;
    await sql`INSERT INTO learner_profiles (user_id) VALUES (${alice}), (${bob})`;
  }, 120_000);

  afterAll(async () => {
    await sql?.end();
    await db?.stop();
  });

  it('reads and writes only the selected learner profile', async () => {
    const repo = createPostgresSettingsRepository(sql);
    expect(await repo.get(alice, 'en')).toEqual(DEFAULT_USER_SETTINGS);
    await repo.save(
      alice,
      {
        assistDefault: 3,
        overlay: { fontSize: 21, opacity: 76, theme: 'light' },
        saveAudio: true,
      },
      'en',
    );

    expect(await repo.get(alice, 'en')).toMatchObject({ assistDefault: 3, saveAudio: true });
    expect(await repo.get(bob, 'en')).toEqual(DEFAULT_USER_SETTINGS);
  });

  it('keeps the assist default per language and the overlay settings shared', async () => {
    const repo = createPostgresSettingsRepository(sql);
    const base = await repo.get(alice, 'en');
    await repo.save(alice, { ...base!, assistDefault: 0 }, 'ja');

    expect((await repo.get(alice, 'ja'))?.assistDefault).toBe(0);
    expect((await repo.get(alice, 'en'))?.assistDefault).toBe(3);
    expect((await repo.get(alice, 'ja'))?.overlay).toEqual((await repo.get(alice, 'en'))?.overlay);
  });
});
