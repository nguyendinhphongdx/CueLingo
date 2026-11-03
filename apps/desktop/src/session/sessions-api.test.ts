import { describe, expect, it, vi } from 'vitest';
import { createSessionsApi, TranscribeError } from './sessions-api';

const session = {
  id: '6df65d24-949f-4456-b5d2-4394c9d7ae16',
  title: null,
  startedAt: '2026-11-03T00:00:00.000Z',
  endedAt: null,
  status: 'live',
  assistLevel: 3,
  language: 'en',
} as const;

describe('sessions api', () => {
  it('creates and ends sessions with the configured URL and bearer token', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(session))
      .mockResolvedValueOnce(
        Response.json({
          ...session,
          endedAt: '2026-11-03T01:00:00.000Z',
          status: 'ended',
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = createSessionsApi({
      apiUrl: 'ws://api.test/',
      token: 'secret-token',
      fetch: request,
    });

    await api.create({ assistLevel: 3 });
    await api.end(session.id);
    await api.remove(session.id);

    expect(request.mock.calls.map(([url]) => url)).toEqual([
      'http://api.test/v1/sessions',
      `http://api.test/v1/sessions/${session.id}/end`,
      `http://api.test/v1/sessions/${session.id}`,
    ]);
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer secret-token' },
      body: JSON.stringify({ assistLevel: 3 }),
    });
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer secret-token' },
    });
    expect(request.mock.calls[2]?.[1]).toMatchObject({ method: 'DELETE' });
  });

  it('parses responses with the shared session schema', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        ...session,
        unexpected: true,
      }),
    );
    const api = createSessionsApi({ apiUrl: 'https://api.test', token: 'token', fetch: request });

    await expect(api.create({ assistLevel: 3 })).rejects.toThrow();
  });

  it('rejects non-success responses', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    const api = createSessionsApi({ apiUrl: 'https://api.test', token: 'token', fetch: request });

    await expect(api.end(session.id)).rejects.toThrow('503');
  });

  describe('transcribe', () => {
    const input = {
      segmentId: '3344ed67-4d83-4778-bcd2-41af6165755f',
      stream: 'mic',
      startMs: 10,
      endMs: 900,
      sampleRate: 16000,
      pcm: 'AAAA',
    } as const;

    it('posts the utterance with the bearer token and parses the text', async () => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ segmentId: input.segmentId, text: 'xin chào' }));
      const api = createSessionsApi({ apiUrl: 'ws://api.test/', token: 'secret', fetch: request });

      await expect(api.transcribe(session.id, input)).resolves.toEqual({
        segmentId: input.segmentId,
        text: 'xin chào',
      });
      const [url, init] = request.mock.calls[0]!;
      expect(url).toBe(`http://api.test/v1/sessions/${session.id}/transcribe`);
      expect(init?.method).toBe('POST');
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer secret');
      expect(JSON.parse(init?.body as string)).toEqual(input);
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    });

    it('fails with a message that holds neither audio nor text', async () => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('xin chào AAAA', { status: 500 }));
      const api = createSessionsApi({ apiUrl: 'http://api.test', token: 't', fetch: request });

      const error = await api.transcribe(session.id, input).catch((e: Error) => e);
      expect((error as Error).message).toBe('Transcribe request failed with status 500');
      expect(error).toBeInstanceOf(TranscribeError);
      expect((error as TranscribeError).status).toBe(500);
    });

    it('does not time out before 16 seconds', async () => {
      vi.useFakeTimers();
      try {
        const request = vi.fn<typeof fetch>(
          (_url, init) =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
            }),
        );
        const api = createSessionsApi({ apiUrl: 'http://api.test', token: 't', fetch: request });
        const settled = vi.fn();
        void api.transcribe(session.id, input).catch(settled);
        await vi.advanceTimersByTimeAsync(15_999);
        expect(settled).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(settled).toHaveBeenCalledOnce();
      } finally {
        vi.useRealTimers();
      }
    });

    it('aborts the request when the caller aborts, without a status', async () => {
      const request = vi.fn<typeof fetch>(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted AAAA')));
          }),
      );
      const api = createSessionsApi({ apiUrl: 'http://api.test', token: 't', fetch: request });
      const caller = new AbortController();
      const result = api.transcribe(session.id, input, caller.signal).catch((e: unknown) => e);
      caller.abort();
      const error = (await result) as TranscribeError;
      expect(error).toBeInstanceOf(TranscribeError);
      expect(error.message).toBe('Transcribe request aborted');
      expect(error.status).toBeUndefined();
    });

    it('times out after 16 seconds', async () => {
      vi.useFakeTimers();
      try {
        const request = vi.fn<typeof fetch>(
          (_url, init) =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => reject(new Error('aborted AAAA')));
            }),
        );
        const api = createSessionsApi({ apiUrl: 'http://api.test', token: 't', fetch: request });
        const result = api.transcribe(session.id, input).catch((e: Error) => e);
        await vi.advanceTimersByTimeAsync(16_000);
        expect(((await result) as Error).message).toBe('Transcribe request timed out');
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
