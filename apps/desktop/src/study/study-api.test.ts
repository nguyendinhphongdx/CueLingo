import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStudyApi } from './study-api';

const card = {
  itemId: '11111111-1111-4111-8111-111111111111',
  exercise: 'recognize' as const,
  phrase: 'circle back',
  prompt: 'circle back',
  choices: ['quay lại vấn đề', 'kết thúc sớm'],
  answer: 'quay lại vấn đề',
  meaningVi: 'quay lại vấn đề',
  contextEn: "Let's circle back after lunch.",
};

describe('study api', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses one configured client for review and phrase endpoints', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ dueCount: 1, cards: [card] }))
      .mockResolvedValueOnce(Response.json({ nextDue: '2026-11-07T00:00:00.000Z' }))
      .mockResolvedValueOnce(Response.json({ phrases: [] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = createStudyApi({ apiUrl: 'ws://api.test/', token: 'secret-token', fetch: request });

    await api.getReviewQueue();
    await api.answerReview({
      itemId: card.itemId,
      exercise: card.exercise,
      rating: 3,
      responseMs: 1250,
    });
    await api.getPhrases();
    await api.removePhrase('22222222-2222-4222-8222-222222222222');

    expect(request.mock.calls.map(([url]) => url)).toEqual([
      'http://api.test/v1/review/queue?dictation=1&language=en',
      'http://api.test/v1/review/answer',
      'http://api.test/v1/phrases?language=en',
      'http://api.test/v1/phrases/22222222-2222-4222-8222-222222222222',
    ]);
    for (const [, init] of request.mock.calls) {
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer secret-token' });
    }
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        itemId: card.itemId,
        exercise: card.exercise,
        rating: 3,
        responseMs: 1250,
      }),
    });
  });

  it('parses successful responses with shared schemas', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        dueCount: 0,
        cards: [],
        unexpected: true,
      }),
    );
    const api = createStudyApi({ apiUrl: 'https://api.test', token: 'token', fetch: request });

    await expect(api.getReviewQueue()).rejects.toThrow();
  });

  it('rejects non-success responses', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    const api = createStudyApi({ apiUrl: 'https://api.test', token: 'token', fetch: request });

    await expect(api.getPhrases()).rejects.toThrow('503');
  });
});

describe('study api speech', () => {
  it('asks for spoken audio with the text in the body and returns the audio', async () => {
    const audio = new Blob([new Uint8Array([82, 73, 70, 70])], { type: 'audio/wav' });
    const fetcher = vi.fn(async () => new Response(audio, { status: 200 }));
    const api = createStudyApi({
      apiUrl: 'http://api.test',
      token: 'cld_token',
      fetch: fetcher as unknown as typeof fetch,
    });

    const blob = await api.speak('push back');

    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.test/v1/tts');
    expect(url).not.toContain('push');
    expect(JSON.parse(String(init.body))).toEqual({ text: 'push back' });
    expect(blob.size).toBe(4);
  });

  it('fails when the server cannot make the audio', async () => {
    const api = createStudyApi({
      apiUrl: 'http://api.test',
      token: 'cld_token',
      fetch: (async () => new Response('{}', { status: 502 })) as unknown as typeof fetch,
    });
    await expect(api.speak('push back')).rejects.toThrow('502');
  });

  it('asks for the language it was given', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ phrases: [] }));
    const api = createStudyApi({ apiUrl: 'ws://api.test/', token: 'secret-token', fetch: request });

    await api.getPhrases('ja');

    expect(request.mock.calls[0]?.[0]).toBe('http://api.test/v1/phrases?language=ja');
  });
});
