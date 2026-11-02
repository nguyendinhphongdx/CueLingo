import { describe, expect, it, vi } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryTtsCache } from './tts.cache';
import { createTtsService } from './tts.service';

const audio = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);
const gatewayWith = () => ({
  speech: vi.fn(async () => ({
    audio,
    mimeType: 'audio/wav' as const,
    model: 'm',
    fallback: false,
    latencyMs: 5,
  })),
});

describe('tts service', () => {
  it('generates once and serves repeats from the cache, ignoring spacing', async () => {
    const gateway = gatewayWith();
    const service = createTtsService({ gateway, cache: createInMemoryTtsCache() });

    expect((await service.speak('alice', 'push back')).cache).toBe('miss');
    expect((await service.speak('bob', '  push   back ')).cache).toBe('hit');
    expect(gateway.speech).toHaveBeenCalledTimes(1);
  });

  it('shares one generation between concurrent requests for the same text', async () => {
    const gateway = gatewayWith();
    const service = createTtsService({ gateway, cache: createInMemoryTtsCache() });

    await Promise.all([service.speak('a', 'circle back'), service.speak('b', 'circle back')]);
    expect(gateway.speech).toHaveBeenCalledTimes(1);
  });

  it('limits fresh generations per person per minute but never cache hits', async () => {
    let now = 0;
    const gateway = gatewayWith();
    const service = createTtsService({
      gateway,
      cache: createInMemoryTtsCache(),
      perMinute: 2,
      clock: () => now,
    });

    await service.speak('alice', 'one');
    await service.speak('alice', 'two');
    await expect(service.speak('alice', 'three')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect((await service.speak('alice', 'one')).cache).toBe('hit');
    await service.speak('bob', 'three');

    now = 61_000;
    await expect(service.speak('alice', 'three')).resolves.toBeDefined();
  });

  it('reports a generation failure as TTS_FAILED and leaves nothing cached', async () => {
    const cache = createInMemoryTtsCache();
    const gateway = { speech: vi.fn(async () => Promise.reject(new Error('down'))) };
    const service = createTtsService({ gateway, cache });

    await expect(service.speak('alice', 'hello')).rejects.toMatchObject({ code: 'TTS_FAILED' });
    expect(cache.size()).toBe(0);
  });
});

describe('POST /v1/tts', () => {
  const as = (user: string) => ({ [TEST_USER_HEADER]: user });

  it('returns audio with cache headers, then a hit', async () => {
    const app = await buildTestApp({
      tts: { gateway: gatewayWith(), cache: createInMemoryTtsCache() },
    });
    const first = await app.inject({
      method: 'POST',
      url: '/v1/tts',
      headers: as('alice'),
      payload: { text: 'Can we push back the deadline?' },
    });
    expect(first.statusCode).toBe(200);
    expect(first.headers['content-type']).toContain('audio/wav');
    expect(first.headers['x-tts-cache']).toBe('miss');
    expect(first.rawPayload.length).toBe(audio.length);

    const second = await app.inject({
      method: 'POST',
      url: '/v1/tts',
      headers: as('alice'),
      payload: { text: 'Can we push back the deadline?' },
    });
    expect(second.headers['x-tts-cache']).toBe('hit');
    await app.close();
  });

  it('rejects empty, oversized and extra-field bodies, and needs a session', async () => {
    const app = await buildTestApp({
      tts: { gateway: gatewayWith(), cache: createInMemoryTtsCache() },
    });
    for (const payload of [{ text: '  ' }, { text: 'x'.repeat(301) }, { text: 'ok', voice: 'x' }]) {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tts',
        headers: as('alice'),
        payload,
      });
      expect(response.statusCode).toBe(400);
    }
    const anonymous = await app.inject({
      method: 'POST',
      url: '/v1/tts',
      payload: { text: 'hello' },
    });
    expect(anonymous.statusCode).toBe(401);
    await app.close();
  });
});
