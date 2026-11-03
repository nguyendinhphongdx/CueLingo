import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemorySessionsRepository, type SessionsRepository } from './index';

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
      payload: { assistLevel: 3, language: 'xx' },
    });
    expect(bad.statusCode).toBe(400);
  });

  it("switches a running meeting's language, only for its owner and only to a language that is on", async () => {
    const created = await create();
    const url = `/v1/sessions/${created.json().id}`;
    const patch = (user: string, language: string) =>
      app.inject({ method: 'PATCH', url, headers: as(user), payload: { language } });

    expect((await patch(ALICE, 'en')).statusCode).toBe(200);
    expect((await patch(ALICE, 'xx')).statusCode).toBe(400);
    expect((await patch(BOB, 'en')).statusCode).toBe(404);
  });

  describe('POST /:id/debrief', () => {
    let repo: SessionsRepository;
    let dapp: Awaited<ReturnType<typeof buildTestApp>>;

    beforeEach(async () => {
      repo = createInMemorySessionsRepository();
      dapp = await buildTestApp({ repos: { sessions: repo } });
    });
    afterEach(() => dapp.close());

    const make = async (user: string, { segment = true, end = true } = {}) => {
      const session = await repo.create(user, { assistLevel: 3, language: 'en' });
      if (segment) {
        await repo.saveSegment({
          sessionId: session.id,
          userId: user,
          segmentId: randomUUID(),
          source: 'system',
          startMs: 0,
          endMs: 1000,
          textEn: 'hello',
        });
      }
      if (end) await repo.end(user, session.id);
      return session.id;
    };
    const regenerate = (user: string, id: string) =>
      dapp.inject({ method: 'POST', url: `/v1/sessions/${id}/debrief`, headers: as(user) });

    it('queues the debrief for an ended session with a transcript and answers 202', async () => {
      const id = await make(ALICE);

      const res = await regenerate(ALICE, id);

      expect(res.statusCode).toBe(202);
      expect(res.json()).toEqual({ queued: true });
      expect(dapp.queue.jobs).toEqual([{ name: 'debrief.generate', payload: { sessionId: id } }]);
    });

    it('does not queue a second job for repeated clicks', async () => {
      const id = await make(ALICE);

      expect((await regenerate(ALICE, id)).statusCode).toBe(202);
      expect((await regenerate(ALICE, id)).statusCode).toBe(202);
      expect(dapp.queue.jobs).toHaveLength(1);
    });

    it('refuses a live session and a session without segments with 409', async () => {
      const live = await make(ALICE, { end: false });
      const empty = await make(ALICE, { segment: false });

      for (const id of [live, empty]) {
        const res = await regenerate(ALICE, id);
        expect(res.statusCode).toBe(409);
        expect(res.json().error.code).toBe('CONFLICT');
      }
      expect(dapp.queue.jobs).toEqual([]);
    });

    it("answers 404 for another user's or an unknown session, same as end", async () => {
      const id = await make(ALICE);

      const other = await regenerate(BOB, id);
      const unknown = await regenerate(BOB, randomUUID());

      expect(other.statusCode).toBe(404);
      expect(unknown.statusCode).toBe(404);
      expect(other.json().error.message).toBe(unknown.json().error.message);
      expect(dapp.queue.jobs).toEqual([]);
    });

    it('requires authentication', async () => {
      const id = await make(ALICE);
      const res = await dapp.inject({ method: 'POST', url: `/v1/sessions/${id}/debrief` });
      expect(res.statusCode).toBe(401);
    });

    it('limits each user to three requests per minute', async () => {
      const ids = [await make(ALICE), await make(ALICE), await make(ALICE), await make(ALICE)];
      const codes = [];
      for (const id of ids) codes.push((await regenerate(ALICE, id)).statusCode);
      expect(codes).toEqual([202, 202, 202, 429]);

      const bobId = await make(BOB);
      expect((await regenerate(BOB, bobId)).statusCode).toBe(202);
    });
  });
});
