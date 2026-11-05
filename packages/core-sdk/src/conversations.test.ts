import { describe, expect, it, vi } from 'vitest';
import { ApiError, createClient } from './index';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const ID = '6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const conversation = {
  id: ID,
  title: 'Họp',
  language: 'en',
  createdAt: '2026-11-05T00:00:00.000Z',
  updatedAt: '2026-11-05T00:00:00.000Z',
};

const make = (fetch: ReturnType<typeof vi.fn>) =>
  createClient({
    baseUrl: 'http://api',
    getToken: () => 't0k',
    fetch: fetch as typeof globalThis.fetch,
  });

describe('conversations client', () => {
  it('lists, creates, renames and removes with the right routes', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(200, { items: [conversation] }))
      .mockResolvedValueOnce(json(201, conversation))
      .mockResolvedValueOnce(json(200, { ...conversation, title: 'Mới' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = make(fetch);

    expect((await client.conversations.list())[0]?.id).toBe(ID);
    await client.conversations.create({ language: 'en' });
    expect((await client.conversations.rename(ID, 'Mới')).title).toBe('Mới');
    await client.conversations.remove(ID);

    const calls = fetch.mock.calls.map((c) => [c[1].method, c[0]]);
    expect(calls).toEqual([
      ['GET', 'http://api/v1/conversations'],
      ['POST', 'http://api/v1/conversations'],
      ['PATCH', `http://api/v1/conversations/${ID}`],
      ['DELETE', `http://api/v1/conversations/${ID}`],
    ]);
    expect(JSON.parse(fetch.mock.calls[2]?.[1].body)).toEqual({ title: 'Mới' });
  });

  it('gets a conversation with its messages', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, { conversation, messages: [] }));
    expect((await make(fetch).conversations.get(ID)).conversation.title).toBe('Họp');
  });

  it('maps 404 to ApiError and rejects a drifted response', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(404, { error: { code: 'NOT_FOUND', message: 'x' } }))
      .mockResolvedValueOnce(json(200, { items: [{ id: 'nope' }] }));
    const client = make(fetch);
    await expect(client.conversations.get(ID)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
    await expect(client.conversations.list()).rejects.toThrow();
    expect(new ApiError(0, 'NETWORK_ERROR', 'x')).toBeInstanceOf(Error);
  });

  it('refuses an empty title before calling the server', () => {
    const fetch = vi.fn();
    expect(() => make(fetch).conversations.rename(ID, '')).toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
