import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';

const ALICE = 'alice';
const BOB = 'bob';

describe('phrases module', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });
  afterEach(() => app.close());

  const as = (user: string) => ({ [TEST_USER_HEADER]: user });
  const save = (user: string, payload: unknown) =>
    app.inject({
      method: 'POST',
      url: '/v1/phrases',
      headers: as(user),
      payload: payload as object,
    });

  it('saves a normalized phrase in the review list', async () => {
    const created = await save(ALICE, { phrase: '  Circle   Back  ', meaningVi: 'trao đổi lại' });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      phrase: 'circle back',
      meaningVi: 'trao đổi lại',
      inReview: true,
    });

    const list = await app.inject({ method: 'GET', url: '/v1/phrases', headers: as(ALICE) });
    expect(list.json().phrases).toEqual([created.json()]);
  });

  it('saves the same normalized phrase idempotently and updates a supplied meaning', async () => {
    const first = await save(ALICE, { phrase: 'Circle Back', meaningVi: 'nói lại' });
    const repeated = await save(ALICE, { phrase: '  circle   BACK ', meaningVi: 'trao đổi lại' });

    expect(repeated.json()).toMatchObject({ id: first.json().id, meaningVi: 'trao đổi lại' });
    const list = await app.inject({ method: 'GET', url: '/v1/phrases', headers: as(ALICE) });
    expect(list.json().phrases).toHaveLength(1);
  });

  it("never shows or deletes another user's phrase", async () => {
    const { id } = (await save(ALICE, { phrase: 'Circle back' })).json();
    const list = await app.inject({ method: 'GET', url: '/v1/phrases', headers: as(BOB) });
    expect(list.json().phrases).toEqual([]);

    const foreignDelete = await app.inject({
      method: 'DELETE',
      url: `/v1/phrases/${id}`,
      headers: as(BOB),
    });
    expect(foreignDelete.statusCode).toBe(404);
    const aliceList = await app.inject({
      method: 'GET',
      url: '/v1/phrases',
      headers: as(ALICE),
    });
    expect(aliceList.json().phrases).toHaveLength(1);
  });

  it('deletes an owned phrase from the user lexicon', async () => {
    const { id } = (await save(ALICE, { phrase: 'Circle back' })).json();
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/v1/phrases/${id}`,
      headers: as(ALICE),
    });
    expect(deleted.statusCode).toBe(204);
    const list = await app.inject({ method: 'GET', url: '/v1/phrases', headers: as(ALICE) });
    expect(list.json().phrases).toEqual([]);
  });

  it('returns 400 for invalid input and 401 without a session', async () => {
    expect((await save(ALICE, { phrase: '' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/v1/phrases' })).statusCode).toBe(401);
  });
});
