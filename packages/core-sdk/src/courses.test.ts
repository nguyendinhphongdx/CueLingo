import { describe, expect, it, vi } from 'vitest';
import { createClient } from './index';

const SESSION = '3f2b9a52-6a4e-4d1e-9a52-1f7a7a3b9c10';
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
const clientWith = (body: unknown) => {
  const fetch = vi.fn().mockResolvedValue(json(body));
  return { fetch, client: createClient({ baseUrl: 'http://api', getToken: () => 't0k', fetch }) };
};

describe('courses client', () => {
  it('lists courses for a language', async () => {
    const { client, fetch } = clientWith({ courses: [], nextUp: null });
    expect(await client.courses.list('ja')).toEqual({ courses: [], nextUp: null });
    expect(fetch.mock.calls[0]?.[0]).toBe('http://api/v1/courses?language=ja');
    expect(fetch.mock.calls[0]?.[1].headers.authorization).toBe('Bearer t0k');
  });

  it('starts a course and asks for a queue with dictation', async () => {
    const started = clientWith({ added: 3 });
    expect(await started.client.courses.start(SESSION)).toEqual({ added: 3 });
    expect(started.fetch.mock.calls[0]?.[1].method).toBe('POST');

    const queue = clientWith({ dueCount: 0, cards: [] });
    await queue.client.courses.queue(SESSION, { dictation: true });
    expect(queue.fetch.mock.calls[0]?.[0]).toBe(
      `http://api/v1/courses/${SESSION}/queue?dictation=1`,
    );
  });

  it('sends only session ids for preparation', async () => {
    const { client, fetch } = clientWith({ lessons: [], terms: [] });
    await client.courses.prep({ sessionIds: [SESSION] });
    expect(fetch.mock.calls[0]?.[1].body).toBe(JSON.stringify({ sessionIds: [SESSION] }));
  });

  it('rejects a response that breaks the contract', async () => {
    const { client } = clientWith({ courses: [{ sessionId: 'x' }], nextUp: null });
    await expect(client.courses.list()).rejects.toBeDefined();
  });
});
