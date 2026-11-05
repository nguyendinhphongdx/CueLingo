import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryFeedbackRepository } from './index';

const ALICE = 'alice';
const BOB = 'bob';
const body = {
  kind: 'bug',
  message: 'Caption bị trễ khi đổi ngôn ngữ',
  client: 'desktop',
  appVersion: '0.1.1',
  os: 'macOS 15.1',
};

describe('feedback module', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let repo: ReturnType<typeof createInMemoryFeedbackRepository>;

  beforeEach(async () => {
    repo = createInMemoryFeedbackRepository();
    app = await buildTestApp({ repos: { feedback: repo } });
  });
  afterEach(() => app.close());

  const send = (user: string | null, payload: object) =>
    app.inject({
      method: 'POST',
      url: '/v1/feedback',
      headers: user ? { [TEST_USER_HEADER]: user } : {},
      payload,
    });

  // AC6
  it('stores the message with app version and OS for the signed-in person', async () => {
    const res = await send(ALICE, body);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ id: expect.any(String), createdAt: expect.any(String) });
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]).toMatchObject({ ...body, userId: ALICE });
  });

  it('rejects more than 2000 characters and an empty message', async () => {
    expect((await send(ALICE, { ...body, message: 'x'.repeat(2001) })).statusCode).toBe(400);
    expect((await send(ALICE, { ...body, message: '  ' })).statusCode).toBe(400);
    expect(repo.rows).toHaveLength(0);
  });

  // AC6 + AC9: a body cannot smuggle a transcript, audio, a token or someone else's id.
  it.each(['transcript', 'audio', 'token', 'userId'])(
    'rejects a %s field in the body',
    async (field) => {
      const res = await send(ALICE, { ...body, [field]: 'BOB' });
      expect(res.statusCode).toBe(400);
      expect(repo.rows).toHaveLength(0);
    },
  );

  it('needs a signed-in user', async () => {
    expect((await send(null, body)).statusCode).toBe(401);
  });

  // AC9
  it('counts the limit per person, never across people', async () => {
    for (let i = 0; i < 10; i++) expect((await send(ALICE, body)).statusCode).toBe(201);
    expect((await send(ALICE, body)).statusCode).toBe(429);
    expect((await send(BOB, body)).statusCode).toBe(201);
    expect(repo.rows.filter((r) => r.userId === BOB)).toHaveLength(1);
  });

  it('has no route that reads feedback back', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/feedback',
      headers: { [TEST_USER_HEADER]: ALICE },
    });
    expect(res.statusCode).toBe(404);
  });
});
