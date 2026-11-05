import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryPhrasesRepository } from './index';

const ALICE = 'alice';
const BOB = 'bob';

describe('phrases module', () => {
  let app: FastifyInstance;
  let repo: ReturnType<typeof createInMemoryPhrasesRepository>;

  beforeEach(async () => {
    repo = createInMemoryPhrasesRepository();
    app = await buildTestApp({ repos: { phrases: repo } });
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

  it('reads one language at a time and defaults to English', async () => {
    await save(ALICE, { phrase: 'circle back' });
    const japanese = await app.inject({
      method: 'GET',
      url: '/v1/phrases?language=ja',
      headers: as(ALICE),
    });
    expect(japanese.statusCode).toBe(200);
    expect(japanese.json().phrases).toEqual([]);
    const bad = await app.inject({
      method: 'GET',
      url: '/v1/phrases?language=xx',
      headers: as(ALICE),
    });
    expect(bad.statusCode).toBe(400);
  });

  it('keeps the sentence a phrase was saved from and puts the phrase in review', async () => {
    const created = await save(ALICE, {
      phrase: 'Circle Back',
      context: "Let's circle back on this after the demo.",
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().inReview).toBe(true);
    expect(repo.contextOf(ALICE, created.json().id)).toBe(
      "Let's circle back on this after the demo.",
    );
    // The sentence is the user's: nobody else sees it.
    expect(repo.contextOf(BOB, created.json().id)).toBeNull();
  });

  it('keeps one row for the same phrase in other case and spacing, and keeps the first sentence', async () => {
    const first = await save(ALICE, { phrase: 'Follow  Up', context: 'First sentence.' });
    const again = await save(ALICE, { phrase: ' follow up ', context: 'Second sentence.' });
    const other = await save(ALICE, { phrase: 'FOLLOW UP' });

    expect(again.json().id).toBe(first.json().id);
    expect(other.json().id).toBe(first.json().id);
    expect(other.json().phrase).toBe('follow up');
    expect(other.json().inReview).toBe(true);
    expect(repo.contextOf(ALICE, first.json().id)).toBe('First sentence.');
    const list = await app.inject({ method: 'GET', url: '/v1/phrases', headers: as(ALICE) });
    expect(list.json().phrases).toHaveLength(1);
  });

  it('rejects a context longer than 500 characters', async () => {
    const res = await save(ALICE, { phrase: 'circle back', context: 'x'.repeat(501) });
    expect(res.statusCode).toBe(400);
  });
});
