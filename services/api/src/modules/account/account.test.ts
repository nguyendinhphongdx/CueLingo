import { DELETE_ACCOUNT_CONFIRMATION } from '@cuelingo/shared';
import { describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryAccountRepository } from './account.repository';

const ALICE = '00000000-0000-4000-8000-0000000000a1';
const BOB = '00000000-0000-4000-8000-0000000000b1';
const as = (user: string) => ({ [TEST_USER_HEADER]: user });
const person = (id: string, name: string) => ({
  id,
  email: `${name.toLowerCase()}@example.com`,
  name,
  createdAt: '2026-11-01T09:00:00.000Z',
});

async function setup() {
  const account = createInMemoryAccountRepository();
  account.seed(person(ALICE, 'Alice'));
  account.seed(person(BOB, 'Bob'));
  const app = await buildTestApp({ repos: { account } });
  return { app, account };
}

describe('account routes', () => {
  it('returns only the signed-in person', async () => {
    const { app } = await setup();
    const response = await app.inject({ method: 'GET', url: '/v1/me', headers: as(ALICE) });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: ALICE, email: 'alice@example.com', name: 'Alice' });
    await app.close();
  });

  it('renames with a trimmed name and leaves others alone', async () => {
    const { app } = await setup();
    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/me',
      headers: as(ALICE),
      payload: { name: '  Alice Nguyen  ' },
    });
    expect(response.json().name).toBe('Alice Nguyen');
    const bob = await app.inject({ method: 'GET', url: '/v1/me', headers: as(BOB) });
    expect(bob.json().name).toBe('Bob');
    await app.close();
  });

  it('rejects an empty or oversized name and unknown fields', async () => {
    const { app } = await setup();
    for (const payload of [
      { name: '   ' },
      { name: 'x'.repeat(81) },
      { name: 'ok', email: 'a@b.c' },
    ]) {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/me',
        headers: as(ALICE),
        payload,
      });
      expect(response.statusCode).toBe(400);
    }
    await app.close();
  });

  it('closes the account only with the exact confirmation', async () => {
    const { app, account } = await setup();
    const wrong = await app.inject({
      method: 'DELETE',
      url: '/v1/me',
      headers: as(ALICE),
      payload: { confirm: 'xoa tai khoan' },
    });
    expect(wrong.statusCode).toBe(400);
    expect(await account.get(ALICE)).not.toBeNull();

    const right = await app.inject({
      method: 'DELETE',
      url: '/v1/me',
      headers: as(ALICE),
      payload: { confirm: DELETE_ACCOUNT_CONFIRMATION },
    });
    expect(right.statusCode).toBe(204);
    expect(await account.get(ALICE)).toBeNull();
    expect(await account.get(BOB)).not.toBeNull();
    await app.close();
  });

  it('requires a session', async () => {
    const { app } = await setup();
    expect((await app.inject({ method: 'GET', url: '/v1/me' })).statusCode).toBe(401);
    await app.close();
  });
});
