import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';

const ALICE = 'alice';
const BOB = 'bob';

describe('sessions module', () => {
  let app: FastifyInstance & { queue: { jobs: Array<{ name: string; payload: unknown }> } };

  beforeEach(async () => {
    app = await buildTestApp();
  });
  afterEach(() => app.close());

  const as = (user: string) => ({ [TEST_USER_HEADER]: user });
  const create = (user = ALICE, title = 'Weekly sync') =>
    app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: as(user),
      payload: { title, assistLevel: 3 },
    });

  it('creates a live session for the authenticated user and lists newest first', async () => {
    const first = await create(ALICE, ' First ');
    const second = await create(ALICE, 'Second');

    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ title: 'First', status: 'live', assistLevel: 3 });
    const list = await app.inject({ method: 'GET', url: '/v1/sessions', headers: as(ALICE) });
    expect(list.json().sessions.map((session: { id: string }) => session.id)).toEqual([
      second.json().id,
      first.json().id,
    ]);
    expect(
      (await app.inject({ method: 'GET', url: '/v1/sessions', headers: as(BOB) })).json().sessions,
    ).toEqual([]);
  });

  it('ends once and enqueues exactly one debrief job when called again', async () => {
    const { id } = (await create()).json();

    const first = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${id}/end`,
      headers: as(ALICE),
    });
    const second = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${id}/end`,
      headers: as(ALICE),
    });

    expect(first.json()).toMatchObject({ status: 'ended' });
    expect(first.json().endedAt).not.toBeNull();
    expect(second.json()).toEqual(first.json());
    expect(app.queue.jobs).toEqual([{ name: 'debrief.generate', payload: { sessionId: id } }]);
  });

  it("returns 404 for another user's detail and end requests", async () => {
    const { id } = (await create()).json();
    const detail = await app.inject({
      method: 'GET',
      url: `/v1/sessions/${id}`,
      headers: as(BOB),
    });
    const end = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${id}/end`,
      headers: as(BOB),
    });

    expect(detail.statusCode).toBe(404);
    expect(end.statusCode).toBe(404);
    expect(app.queue.jobs).toEqual([]);
  });

  it('soft-deletes an owned session and hides it from list and detail', async () => {
    const mine = (await create(ALICE)).json();
    const theirs = (await create(BOB, 'Bob meeting')).json();

    const denied = await app.inject({
      method: 'DELETE',
      url: `/v1/sessions/${theirs.id}`,
      headers: as(ALICE),
    });
    expect(denied.statusCode).toBe(404);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/v1/sessions/${mine.id}`,
      headers: as(ALICE),
    });
    expect(deleted.statusCode).toBe(204);
    expect(
      (await app.inject({ method: 'GET', url: '/v1/sessions', headers: as(ALICE) })).json()
        .sessions,
    ).toEqual([]);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/v1/sessions/${mine.id}`,
          headers: as(ALICE),
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'GET', url: '/v1/sessions', headers: as(BOB) })).json().sessions,
    ).toHaveLength(1);
  });

  it('rejects invalid input and requires authentication', async () => {
    const invalid = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: as(ALICE),
      payload: { assistLevel: 8 },
    });
    const anonymous = await app.inject({ method: 'GET', url: '/v1/sessions' });
    expect(invalid.statusCode).toBe(400);
    expect(anonymous.statusCode).toBe(401);
  });

  it('stores the meeting language, defaulting to English, and refuses one that is not on yet', async () => {
    expect((await create()).json().language).toBe('en');
    const bad = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: as(ALICE),
      payload: { assistLevel: 3, language: 'ja' },
    });
    expect(bad.statusCode).toBe(400);
  });

  it("switches a running meeting's language, only for its owner and only to a language that is on", async () => {
    const created = await create();
    const url = `/v1/sessions/${created.json().id}`;
    const patch = (user: string, language: string) =>
      app.inject({ method: 'PATCH', url, headers: as(user), payload: { language } });

    expect((await patch(ALICE, 'en')).statusCode).toBe(200);
    expect((await patch(ALICE, 'ja')).statusCode).toBe(400);
    expect((await patch(BOB, 'en')).statusCode).toBe(404);
  });
});
