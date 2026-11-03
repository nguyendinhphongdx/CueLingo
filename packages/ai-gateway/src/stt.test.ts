import { describe, expect, it, vi } from 'vitest';
import { createGeminiTranscribe } from './stt';

const args = (audio = new Uint8Array([1, 2, 3])) => ({
  model: 'm',
  system: 'sys',
  prompt: 'p',
  audio,
  signal: new AbortController().signal,
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('createGeminiTranscribe', () => {
  it('posts inline WAV audio with the key in a header and joins the text parts', async () => {
    const request = vi.fn(async () =>
      json({
        candidates: [{ content: { parts: [{ text: 'xin ' }, { text: 'chào' }] } }],
        usageMetadata: { promptTokenCount: 64, candidatesTokenCount: 3 },
      }),
    );
    const out = await createGeminiTranscribe('KEY', request as never)(args());

    expect(out).toEqual({ text: 'xin chào', inputTokens: 64, outputTokens: 3 });
    const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/models/m:generateContent');
    expect(url).not.toContain('KEY');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('KEY');
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[1].inlineData).toEqual({
      mimeType: 'audio/wav',
      data: Buffer.from([1, 2, 3]).toString('base64'),
    });
  });

  it('returns an empty text when the model answers with nothing', async () => {
    const request = vi.fn(async () => json({ candidates: [{}] }));
    await expect(createGeminiTranscribe('k', request as never)(args())).resolves.toMatchObject({
      text: '',
    });
  });

  it('reports only the status on failure, never the provider message', async () => {
    const request = vi.fn(async () => json({ error: { message: 'echoed: private words' } }, 503));
    const error = await createGeminiTranscribe(
      'k',
      request as never,
    )(args()).catch((e: Error) => e);
    expect((error as Error).message).toBe('transcribe request failed (503)');
  });
});
