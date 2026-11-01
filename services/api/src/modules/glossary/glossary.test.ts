import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';

const ALICE = 'alice';
const BOB = 'bob';

describe('glossary module', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });
  afterEach(() => app.close());

  const as = (user: string) => ({ [TEST_USER_HEADER]: user });
  const create = (user: string, payload: unknown) =>
    app.inject({
      method: 'POST',
      url: '/v1/glossary',
      headers: as(user),
      payload: payload as object,
    });

  it('creates a term and lists it', async () => {
    const created = await create(ALICE, { term: ' Acme ', translation: 'Acme' });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ term: 'Acme', translation: 'Acme', note: null });

    const list = await app.inject({ method: 'GET', url: '/v1/glossary', headers: as(ALICE) });
    expect(list.json().items).toHaveLength(1);
  });

  it('never shows one user the terms of another', async () => {
    await create(ALICE, { term: 'Acme' });
    const list = await app.inject({ method: 'GET', url: '/v1/glossary', headers: as(BOB) });
    expect(list.json().items).toEqual([]);
  });

  it('rejects a duplicate term (case-insensitive) with 409', async () => {
    await create(ALICE, { term: 'Acme' });
    const duplicate = await create(ALICE, { term: 'acme' });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe('CONFLICT');
  });

  it('returns 400 with details for invalid input', async () => {
    const res = await create(ALICE, { term: '' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.details[0].path).toBe('term');
  });

  it('returns 404 when updating or deleting a term the user does not own', async () => {
    const { id } = (await create(ALICE, { term: 'Acme' })).json();
    const patch = await app.inject({
      method: 'PATCH',
      url: `/v1/glossary/${id}`,
      headers: as(BOB),
      payload: { note: 'x' },
    });
    expect(patch.statusCode).toBe(404);
    const del = await app.inject({ method: 'DELETE', url: `/v1/glossary/${id}`, headers: as(BOB) });
    expect(del.statusCode).toBe(404);
  });

  it('updates and deletes an owned term', async () => {
    const { id } = (await create(ALICE, { term: 'Acme' })).json();
    const patch = await app.inject({
      method: 'PATCH',
      url: `/v1/glossary/${id}`,
      headers: as(ALICE),
      payload: { note: 'khách hàng chính' },
    });
    expect(patch.json().note).toBe('khách hàng chính');
    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/glossary/${id}`,
      headers: as(ALICE),
    });
    expect(del.statusCode).toBe(204);
  });

  it('requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/glossary' });
    expect(res.statusCode).toBe(401);
  });
});
