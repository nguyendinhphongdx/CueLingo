import { describe, expect, it, vi } from 'vitest';
import { createGeminiSpeak, toWav, wrapPcmAsWav } from './speech';

const text = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.slice(from, to));

describe('wav helpers', () => {
  it('wraps raw PCM in a 44-byte header with the right sizes and rate', () => {
    const wav = wrapPcmAsWav(new Uint8Array(100), 24_000);
    const view = new DataView(wav.buffer);
    expect(wav.length).toBe(144);
    expect(text(wav, 0, 4)).toBe('RIFF');
    expect(text(wav, 8, 12)).toBe('WAVE');
    expect(view.getUint32(4, true)).toBe(136);
    expect(view.getUint32(24, true)).toBe(24_000);
    expect(view.getUint32(40, true)).toBe(100);
  });

  it('keeps a WAV as it is and wraps anything else using the rate in the mime type', () => {
    const wav = wrapPcmAsWav(new Uint8Array(10), 16_000);
    expect(toWav(wav, 'audio/wav')).toBe(wav);

    const pcm = new Uint8Array(10);
    const wrapped = toWav(pcm, 'audio/L16;codec=pcm;rate=16000');
    expect(new DataView(wrapped.buffer).getUint32(24, true)).toBe(16_000);
  });
});

describe('Gemini speech request', () => {
  const audio = Buffer.from(wrapPcmAsWav(new Uint8Array(20), 24_000)).toString('base64');

  it('sends the key in a header, never the URL, and returns the audio', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        candidates: [
          { content: { parts: [{ inlineData: { data: audio, mimeType: 'audio/wav' } }] } },
        ],
        usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 80 },
      }),
    );
    const speak = createGeminiSpeak('secret-key', fetcher as unknown as typeof fetch);
    const result = await speak({
      model: 'm1',
      text: 'hello',
      voice: 'Kore',
      signal: new AbortController().signal,
    });

    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/models/m1:generateContent');
    expect(url).not.toContain('secret-key');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('secret-key');
    expect(JSON.parse(String(init.body)).generationConfig.responseModalities).toEqual(['AUDIO']);
    expect(result).toMatchObject({ inputTokens: 9, outputTokens: 80 });
    expect(result.audio.length).toBe(64);
  });

  it('reports an API error and a response without audio', async () => {
    const failing = vi.fn(async () =>
      Response.json({ error: { message: 'quota' } }, { status: 429 }),
    );
    await expect(
      createGeminiSpeak(
        'k',
        failing as unknown as typeof fetch,
      )({
        model: 'm',
        text: 'x',
        voice: 'Kore',
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow('429');

    const empty = vi.fn(async () => Response.json({ candidates: [] }));
    await expect(
      createGeminiSpeak(
        'k',
        empty as unknown as typeof fetch,
      )({
        model: 'm',
        text: 'x',
        voice: 'Kore',
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow('no audio');
  });
});
