import { describe, expect, it, vi } from 'vitest';
import { ApiError, createClient } from './index';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const segmentId = '6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const input = {
  segmentId,
  stream: 'system' as const,
  startMs: 0,
  endMs: 2000,
  sampleRate: 16000 as const,
  pcm: 'AAAA',
};

describe('transcribe client', () => {
  it('posts the utterance to the session and parses the text', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, { segmentId, text: 'xin chào' }));
    const client = createClient({ baseUrl: 'http://api', getToken: () => 't0k', fetch });

    const result = await client.transcribe('sess-1', input);

    expect(result).toEqual({ segmentId, text: 'xin chào' });
    expect(fetch.mock.calls[0]?.[0]).toBe('http://api/v1/sessions/sess-1/transcribe');
    expect(fetch.mock.calls[0]?.[1].method).toBe('POST');
    expect(fetch.mock.calls[0]?.[1].headers.authorization).toBe('Bearer t0k');
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toEqual(input);
  });

  it('sends the previous sentences in the body when given', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, { segmentId, text: 'ok' }));
    const client = createClient({ baseUrl: 'http://api', getToken: () => 't0k', fetch });
    const previous = ['Câu trước một.', 'Câu trước hai.'];

    await client.transcribe('sess-1', { ...input, previous });

    expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toEqual({ ...input, previous });
  });

  it('surfaces the error code without echoing audio', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        json(413, { error: { code: 'AUDIO_TOO_LARGE', message: 'Audio is too large' } }),
      );
    const client = createClient({ baseUrl: 'http://api', getToken: () => 't0k', fetch });

    const error = await client.transcribe('sess-1', input).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 413, code: 'AUDIO_TOO_LARGE' });
  });
});
