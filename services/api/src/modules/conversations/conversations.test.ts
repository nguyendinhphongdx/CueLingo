import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryConversationsRepository, type ConversationsRepository } from './index';

const ALICE = 'alice';
const BOB = 'bob';

describe('conversations module', () => {
  let app: FastifyInstance;
  let repo: ConversationsRepository;

  beforeEach(async () => {
    repo = createInMemoryConversationsRepository();
    app = await buildTestApp({ repos: { conversations: repo } });
  });
  afterEach(() => app.close());

  const as = (user: string) => ({ [TEST_USER_HEADER]: user });
  const create = (user: string, payload?: unknown) =>
    app.inject({
      method: 'POST',
      url: '/v1/conversations',
      headers: as(user),
      ...(payload === undefined ? {} : { payload: payload as object }),
    });
  const get = (user: string, id: string) =>
    app.inject({ method: 'GET', url: `/v1/conversations/${id}`, headers: as(user) });

  it('creates a conversation with the default language, lists and reads it', async () => {
    const created = await create(ALICE);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ title: '', language: 'en' });

    const list = await app.inject({ method: 'GET', url: '/v1/conversations', headers: as(ALICE) });
    expect(list.json().items).toEqual([created.json()]);

    const detail = await get(ALICE, created.json().id);
    expect(detail.json()).toEqual({ conversation: created.json(), messages: [] });
  });

  it('stores a message as soon as it is sent and names the conversation after the first one', async () => {
    const { id } = (await create(ALICE, { language: 'en' })).json();
    await repo.appendUserMessage(ALICE, id, '  How do I   say no politely in a meeting?  ');
    const assistant = await repo.beginAssistantMessage(ALICE, id);
    expect(assistant).toMatchObject({ seq: 1, role: 'assistant', status: 'streaming' });

    const detail = (await get(ALICE, id)).json();
    expect(detail.conversation.title).toBe('How do I say no politely in a meeting?');
    expect(detail.messages.map((m: { seq: number; role: string }) => [m.seq, m.role])).toEqual([
      [0, 'user'],
      [1, 'assistant'],
    ]);
    expect(detail.messages[0].parts).toEqual([
      { type: 'text', text: '  How do I   say no politely in a meeting?  ' },
    ]);
  });

  it('renames an owned conversation and validates the title', async () => {
    const { id } = (await create(ALICE)).json();
    const renamed = await app.inject({
      method: 'PATCH',
      url: `/v1/conversations/${id}`,
      headers: as(ALICE),
      payload: { title: 'Họp sprint' },
    });
    expect(renamed.json().title).toBe('Họp sprint');
    const empty = await app.inject({
      method: 'PATCH',
      url: `/v1/conversations/${id}`,
      headers: as(ALICE),
      payload: { title: ' ' },
    });
    expect(empty.statusCode).toBe(400);
  });

  it('hides a deleted conversation at once', async () => {
    const { id } = (await create(ALICE)).json();
    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/conversations/${id}`,
      headers: as(ALICE),
    });
    expect(del.statusCode).toBe(204);

    expect((await get(ALICE, id)).statusCode).toBe(404);
    const list = await app.inject({ method: 'GET', url: '/v1/conversations', headers: as(ALICE) });
    expect(list.json().items).toEqual([]);
    expect(await repo.appendUserMessage(ALICE, id, 'late')).toBeNull();
    const again = await app.inject({
      method: 'DELETE',
      url: `/v1/conversations/${id}`,
      headers: as(ALICE),
    });
    expect(again.statusCode).toBe(404);
  });

  it('never shows one user the conversations of another (user B gets 404)', async () => {
    const { id } = (await create(ALICE)).json();
    await repo.appendUserMessage(ALICE, id, 'private question');

    const list = await app.inject({ method: 'GET', url: '/v1/conversations', headers: as(BOB) });
    expect(list.json().items).toEqual([]);
    expect((await get(BOB, id)).statusCode).toBe(404);
    const patch = await app.inject({
      method: 'PATCH',
      url: `/v1/conversations/${id}`,
      headers: as(BOB),
      payload: { title: 'mine now' },
    });
    expect(patch.statusCode).toBe(404);
    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/conversations/${id}`,
      headers: as(BOB),
    });
    expect(del.statusCode).toBe(404);
    expect(await repo.appendUserMessage(BOB, id, 'intruder')).toBeNull();

    const own = (await get(ALICE, id)).json();
    expect(own.conversation.title).toBe('private question');
    expect(own.messages).toHaveLength(1);
  });

  it('reads a message left streaming by a dead process as an error', async () => {
    let clock = new Date('2026-11-09T09:00:00Z');
    const aging = createInMemoryConversationsRepository(() => clock);
    const { id } = await aging.create(ALICE, 'en');
    await aging.beginAssistantMessage(ALICE, id);
    clock = new Date('2026-11-09T09:11:00Z');
    expect((await aging.get(ALICE, id))?.messages[0]?.status).toBe('error');
  });

  it('counts only the caller messages for the quota', async () => {
    const { id } = (await create(ALICE)).json();
    await repo.appendUserMessage(ALICE, id, 'one');
    await repo.beginAssistantMessage(ALICE, id);
    expect(await repo.countUserMessagesSince(ALICE, new Date(0))).toBe(1);
    expect(await repo.countUserMessagesSince(BOB, new Date(0))).toBe(0);
  });

  it('rejects a malformed id and a missing session', async () => {
    expect((await get(ALICE, 'not-a-uuid')).statusCode).toBe(400);
    const res = await app.inject({ method: 'GET', url: '/v1/conversations' });
    expect(res.statusCode).toBe(401);
  });
});
