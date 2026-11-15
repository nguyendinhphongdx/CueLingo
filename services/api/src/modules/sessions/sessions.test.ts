import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolvePlanLimits } from '@cuelingo/shared';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryAdminRepository } from '../admin';
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

describe('debrief quota (AC7)', () => {
  const OWNER = 'owner';
  const EMAILS = { [OWNER]: 'owner@example.com' };
  let repo: SessionsRepository;
  let qapp: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    repo = createInMemorySessionsRepository();
    qapp = await buildTestApp({
      repos: { sessions: repo, admin: createInMemoryAdminRepository(EMAILS) },
      adminEmails: ['owner@example.com'],
      planLimits: resolvePlanLimits({ free: { debriefs: 1 } }),
    });
  });
  afterEach(() => qapp.close());

  const as = (user: string) => ({ [TEST_USER_HEADER]: user });
  const meeting = async (user: string, withText = true) => {
    const session = await repo.create(user, { assistLevel: 3, language: 'en' });
    if (withText) {
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
    return session.id;
  };
  const end = (user: string, id: string) =>
    qapp.inject({ method: 'POST', url: `/v1/sessions/${id}/end`, headers: as(user) });
  const debrief = (user: string, id: string) =>
    qapp.inject({ method: 'GET', url: `/v1/sessions/${id}/debrief`, headers: as(user) });

  it('ends the meeting without a job once the month is used up, and says why', async () => {
    const first = await meeting(ALICE);
    const second = await meeting(ALICE);
    expect((await end(ALICE, first)).statusCode).toBe(200);
    const res = await end(ALICE, second);

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ended');
    expect(qapp.queue.jobs).toEqual([{ name: 'debrief.generate', payload: { sessionId: first } }]);

    const skipped = await debrief(ALICE, second);
    expect(skipped.statusCode).toBe(404);
    expect(skipped.json().error.code).toBe('DEBRIEF_SKIPPED');
    expect(skipped.json().error.details).toEqual({ reason: 'quota' });
    // A meeting whose debrief is merely not ready keeps the plain 404.
    expect((await debrief(ALICE, first)).json().error.code).toBe('NOT_FOUND');
  });

  it('does not charge a meeting without a transcript', async () => {
    const empty = await meeting(ALICE, false);
    const full = await meeting(ALICE);
    await end(ALICE, empty);
    await end(ALICE, full);
    expect(qapp.queue.jobs.map((job) => (job.payload as { sessionId: string }).sessionId)).toEqual([
      empty,
      full,
    ]);
  });

  it('answers 429 QUOTA_EXCEEDED to a regenerate without allowance and keeps the skip flag', async () => {
    const first = await meeting(ALICE);
    const second = await meeting(ALICE);
    await end(ALICE, first);
    await end(ALICE, second);
    const res = await qapp.inject({
      method: 'POST',
      url: `/v1/sessions/${second}/debrief`,
      headers: as(ALICE),
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe('QUOTA_EXCEEDED');
    expect(res.json().error.details).toMatchObject({ metric: 'debriefs', limit: 1, used: 1 });
    expect((await debrief(ALICE, second)).json().error.code).toBe('DEBRIEF_SKIPPED');
  });

  it('counts per user and never skips an admin', async () => {
    await end(ALICE, await meeting(ALICE));
    expect((await end(BOB, await meeting(BOB))).statusCode).toBe(200);
    expect(qapp.queue.jobs).toHaveLength(2);

    for (let i = 0; i < 3; i += 1) await end(OWNER, await meeting(OWNER));
    expect(qapp.queue.jobs).toHaveLength(5);
  });

  it("does not show the skip of one user's meeting to another", async () => {
    await end(ALICE, await meeting(ALICE));
    const skipped = await meeting(ALICE);
    await end(ALICE, skipped);
    const res = await debrief(BOB, skipped);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

describe('end when the debrief step fails', () => {
  it('keeps the meeting ended, logs only the session id, and answers 500', async () => {
    const lines: string[] = [];
    const repo = createInMemorySessionsRepository();
    const app = await buildTestApp({
      repos: { sessions: repo },
      logger: { level: 'error', stream: { write: (line: string) => void lines.push(line) } },
    });
    const session = await repo.create(ALICE, { assistLevel: 3, language: 'en' });
    await repo.saveSegment({
      sessionId: session.id,
      userId: ALICE,
      segmentId: randomUUID(),
      source: 'system',
      startMs: 0,
      endMs: 1000,
      textEn: 'secret words',
    });
    app.queue.enqueue = async () => {
      throw new Error('queue down');
    };

    const res = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${session.id}/end`,
      headers: { [TEST_USER_HEADER]: ALICE },
    });

    expect(res.statusCode).toBe(500);
    expect((await repo.findById(ALICE, session.id))?.status).toBe('ended');
    const log = lines.join('');
    expect(log).toContain('Session ended but its debrief was not queued');
    expect(log).toContain(session.id);
    expect(log).not.toContain('secret words');
    await app.close();
  });
});

describe('session_started event (AC7)', () => {
  it('records exactly one event for the owner, with the meeting language', async () => {
    const sessions = createInMemorySessionsRepository();
    const app = await buildTestApp({ repos: { sessions } });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: { [TEST_USER_HEADER]: ALICE },
      payload: { title: 'Sync', assistLevel: 3 },
    });
    expect(sessions.startedEvents).toEqual([
      {
        userId: ALICE,
        sessionId: res.json().id,
        at: res.json().startedAt,
        language: 'en',
      },
    ]);
    await app.close();
  });
});
