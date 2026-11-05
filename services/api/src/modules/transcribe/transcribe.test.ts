import { Writable } from 'node:stream';
import type { AiGateway } from '@cuelingo/ai-gateway';
import { randomUUID } from 'node:crypto';
import type { FastifyServerOptions } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SUPPORTED_LANGUAGES } from '@cuelingo/shared';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemorySessionsRepository } from '../sessions';

const SAMPLE_RATE_BYTES = 32_000;
const pcmOfSeconds = (seconds: number) =>
  Buffer.alloc(Math.round(seconds * SAMPLE_RATE_BYTES), 1).toString('base64');
const as = (user: string) => ({ [TEST_USER_HEADER]: user });

type Transcribe = AiGateway['transcribe'];
const gatewayReturning = (text = 'Xin chào mọi người') => ({
  transcribe: vi.fn<Transcribe>(async () => ({
    text,
    model: 'm',
    fallback: false,
    latencyMs: 1,
  })),
});

async function setup(
  options: {
    gateway?: { transcribe: ReturnType<typeof gatewayReturning>['transcribe'] };
    transcribe?: { maxRequests?: number; windowMs?: number; clock?: () => number };
    logger?: FastifyServerOptions['logger'];
  } = {},
) {
  const sessions = createInMemorySessionsRepository();
  const gateway = options.gateway ?? gatewayReturning();
  const app = await buildTestApp({
    repos: { sessions },
    transcribe: { gateway, ...options.transcribe },
    logger: options.logger,
  });
  const viSession = await sessions.create('alice', { assistLevel: 0, language: 'vi' });
  const enSession = await sessions.create('alice', { assistLevel: 0 });
  const post = (user: string, sessionId: string, body: Record<string, unknown> = {}) =>
    app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/transcribe`,
      headers: as(user),
      payload: {
        segmentId: randomUUID(),
        stream: 'system',
        startMs: 0,
        endMs: 2_000,
        sampleRate: 16000,
        pcm: pcmOfSeconds(2),
        ...body,
      },
    });
  return { app, gateway, viSession, enSession, post };
}

describe('POST /v1/sessions/:id/transcribe', () => {
  it('returns the text for the segment, wrapping the PCM as a WAV for the gateway', async () => {
    const { gateway, viSession, post } = await setup();
    const segmentId = randomUUID();

    const response = await post('alice', viSession.id, { segmentId });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ segmentId, text: 'Xin chào mọi người' });
    const [input, context] = gateway.transcribe.mock.calls[0]!;
    expect(input.language).toBe('vi');
    expect(input.audio.length).toBe(44 + 64_000);
    expect(String.fromCharCode(...input.audio.slice(0, 4))).toBe('RIFF');
    expect(context).toEqual({ userId: 'alice', sessionId: viSession.id });
  });

  it('forwards the previous sentences to the gateway and works without them', async () => {
    const { gateway, viSession, post } = await setup();
    const previous = ['Câu một.', 'Câu hai.'];
    expect((await post('alice', viSession.id, { previous })).statusCode).toBe(200);
    expect((await post('alice', viSession.id)).statusCode).toBe(200);
    expect(gateway.transcribe.mock.calls[0]![0].previous).toEqual(previous);
    expect(gateway.transcribe.mock.calls[1]![0].previous).toBeUndefined();
  });

  it('rejects more than 3 previous sentences or a 401-character one with 400', async () => {
    const { gateway, viSession, post } = await setup();
    const four = await post('alice', viSession.id, { previous: ['a', 'b', 'c', 'd'] });
    const long = await post('alice', viSession.id, { previous: ['x'.repeat(401)] });
    expect(four.statusCode).toBe(400);
    expect(long.statusCode).toBe(400);
    expect(gateway.transcribe).not.toHaveBeenCalled();
  });

  it('requires a signed-in user', async () => {
    const { app, viSession } = await setup();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${viSession.id}/transcribe`,
      payload: {},
    });
    expect(response.statusCode).toBe(401);
  });

  it("answers 404 for another user's session and for a missing one, without calling the provider", async () => {
    const { gateway, viSession, post } = await setup();

    const foreign = await post('bob', viSession.id);
    const missing = await post('alice', randomUUID());

    expect(foreign.statusCode).toBe(404);
    expect(foreign.json().error.code).toBe('NOT_FOUND');
    expect(missing.statusCode).toBe(404);
    expect(gateway.transcribe).not.toHaveBeenCalled();
  });

  it('rejects a meeting whose language is recognised on the device', async () => {
    const { gateway, enSession, post } = await setup();
    const response = await post('alice', enSession.id);
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('LANGUAGE_NOT_CLOUD');
    expect(gateway.transcribe).not.toHaveBeenCalled();
  });

  it('rejects an invalid body', async () => {
    const { viSession, post } = await setup();
    expect((await post('alice', viSession.id, { sampleRate: 44100 })).statusCode).toBe(400);
    expect((await post('alice', viSession.id, { pcm: '***' })).statusCode).toBe(400);
    expect((await post('alice', viSession.id, { userId: 'bob' })).statusCode).toBe(400);
  });

  it('accepts what the device can emit: the 25 s cap plus a little overshoot', async () => {
    const { gateway, viSession, post } = await setup();
    const overshoot = Buffer.alloc(25 * SAMPLE_RATE_BYTES + 320 * 2, 1).toString('base64');
    expect((await post('alice', viSession.id, { pcm: overshoot })).statusCode).toBe(200);
    const limit = Buffer.alloc(816_000, 1).toString('base64');
    expect(limit.length).toBeLessThan(1_400_000);
    expect((await post('alice', viSession.id, { pcm: limit })).statusCode).toBe(200);
    expect(gateway.transcribe).toHaveBeenCalledTimes(2);
  });

  it('rejects audio longer than 25.5 seconds with 413', async () => {
    const { gateway, viSession, post } = await setup();
    const tooLong = await post('alice', viSession.id, {
      pcm: Buffer.alloc(816_000 + 2, 1).toString('base64'),
    });
    expect(tooLong.statusCode).toBe(413);
    expect(tooLong.json().error.code).toBe('AUDIO_TOO_LARGE');
    expect(gateway.transcribe).not.toHaveBeenCalled();

    expect((await post('alice', viSession.id, { pcm: pcmOfSeconds(25) })).statusCode).toBe(200);
  });

  it('rejects audio with an odd number of bytes as invalid, without echoing it', async () => {
    const { gateway, viSession, post } = await setup();
    const response = await post('alice', viSession.id, { pcm: 'AQID' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(response.json())).not.toContain('AQID');
    expect(gateway.transcribe).not.toHaveBeenCalled();
  });

  it('skips the provider for empty audio', async () => {
    const { gateway, viSession, post } = await setup();
    const response = await post('alice', viSession.id, { pcm: '' });
    expect(response.statusCode).toBe(200);
    expect(response.json().text).toBe('');
    expect(gateway.transcribe).not.toHaveBeenCalled();
  });

  it('reports a provider failure as TRANSCRIBE_FAILED (502) without its message', async () => {
    const gateway = {
      transcribe: vi.fn<Transcribe>(async () => Promise.reject(new Error('echo: private words'))),
    };
    const { viSession, post } = await setup({ gateway });
    const response = await post('alice', viSession.id);
    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('TRANSCRIBE_FAILED');
    expect(response.body).not.toContain('private words');
  });

  it('limits requests per person and keeps other people unaffected', async () => {
    let now = 0;
    const sessions = createInMemorySessionsRepository();
    const gateway = gatewayReturning();
    const app = await buildTestApp({
      repos: { sessions },
      transcribe: { gateway, maxRequests: 3, windowMs: 1_000, clock: () => now },
    });
    const mine = await sessions.create('alice', { assistLevel: 0, language: 'vi' });
    const theirs = await sessions.create('bob', { assistLevel: 0, language: 'vi' });
    const send = (user: string, id: string) =>
      app.inject({
        method: 'POST',
        url: `/v1/sessions/${id}/transcribe`,
        headers: as(user),
        payload: {
          segmentId: randomUUID(),
          stream: 'mic',
          startMs: 0,
          endMs: 1,
          sampleRate: 16000,
          pcm: pcmOfSeconds(0.5),
        },
      });

    for (let i = 0; i < 3; i += 1) expect((await send('alice', mine.id)).statusCode).toBe(200);
    const limited = await send('alice', mine.id);
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe('RATE_LIMITED');
    expect((await send('bob', theirs.id)).statusCode).toBe(200);
    expect(gateway.transcribe).toHaveBeenCalledTimes(4);

    now = 1_001;
    expect((await send('alice', mine.id)).statusCode).toBe(200);
  });

  it('never writes the audio or the text to logs or error bodies', async () => {
    let logs = '';
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logs += chunk.toString();
        callback();
      },
    });
    const secretAudio = Buffer.from('SECRET-AUDIO-BYTES-'.repeat(50)).toString('base64');
    const okGateway = gatewayReturning('confidential spoken words');
    const ok = await setup({ gateway: okGateway, logger: { level: 'info', stream } });
    const success = await ok.post('alice', ok.viSession.id, {
      pcm: secretAudio,
      previous: ['secret earlier sentence'],
    });
    expect(success.statusCode).toBe(200);

    const failing = await setup({
      gateway: {
        transcribe: vi.fn<Transcribe>(async () =>
          Promise.reject(new Error('confidential spoken words')),
        ),
      },
      logger: { level: 'info', stream },
    });
    const failure = await failing.post('alice', failing.viSession.id, { pcm: secretAudio });
    expect(failure.statusCode).toBe(502);

    expect(logs).toContain('utterance transcribed');
    expect(logs).not.toContain(secretAudio);
    expect(logs).not.toContain(secretAudio.slice(0, 40));
    expect(logs).not.toContain('confidential spoken words');
    expect(logs).not.toContain('secret earlier sentence');
    expect(failure.body).not.toContain('confidential');
  });

  describe('speaker labels', () => {
    // The registry ships with labelling off; these tests exercise the mechanism with it on.
    const flags = ['vi', 'ja', 'ko', 'zh'].map(
      (code) => SUPPORTED_LANGUAGES[code as 'vi'] as { labelsSpeakers: boolean },
    );
    const originals = flags.map((f) => f.labelsSpeakers);
    beforeEach(() => flags.forEach((f) => (f.labelsSpeakers = true)));
    afterEach(() => flags.forEach((f, i) => (f.labelsSpeakers = originals[i]!)));
    const known = [{ label: 'speaker_1', hint: 'low voice', lastText: 'We ship Friday.' }];
    const guessing = (speaker?: { label: string; hint?: string }) => ({
      transcribe: vi.fn<Transcribe>((async () => ({
        text: 'Xin chào',
        model: 'm',
        fallback: false,
        latencyMs: 1,
        ...(speaker ? { speaker } : {}),
      })) as unknown as Transcribe),
    });

    it('forwards knownSpeakers and returns a known label for a cloud language system sentence', async () => {
      const gateway = guessing({ label: 'speaker_1' });
      const { viSession, post } = await setup({ gateway });
      const response = await post('alice', viSession.id, { knownSpeakers: known });
      expect(response.json().speaker).toEqual({ label: 'speaker_1' });
      expect(gateway.transcribe.mock.calls[0]![0]).toMatchObject({ knownSpeakers: known });
    });

    it('keeps `new` with its hint and turns a label that was never sent into unknown', async () => {
      const fresh = await setup({ gateway: guessing({ label: 'new', hint: 'high, fast' }) });
      const created = await fresh.post('alice', fresh.viSession.id, { knownSpeakers: [] });
      expect(created.json().speaker).toEqual({ label: 'new', hint: 'high, fast' });

      const stray = await setup({ gateway: guessing({ label: 'speaker_5' }) });
      const response = await stray.post('alice', stray.viSession.id, { knownSpeakers: known });
      expect(response.json().speaker).toEqual({ label: 'unknown' });

      const unclear = await setup({ gateway: guessing() });
      const none = await unclear.post('alice', unclear.viSession.id, { knownSpeakers: known });
      expect(none.json().speaker).toEqual({ label: 'unknown' });
    });

    it('does not ask the gateway for labels on the mic stream, and answers old clients without `speaker`', async () => {
      const gateway = guessing({ label: 'speaker_1' });
      const { viSession, post } = await setup({ gateway });
      const mic = await post('alice', viSession.id, { stream: 'mic', knownSpeakers: known });
      expect(gateway.transcribe.mock.calls[0]![0]).not.toHaveProperty('knownSpeakers');
      expect(mic.json().speaker).toEqual({ label: 'unknown' });

      const old = await post('alice', viSession.id);
      expect(gateway.transcribe.mock.calls[1]![0]).not.toHaveProperty('knownSpeakers');
      expect(old.json()).not.toHaveProperty('speaker');
    });

    it('logs only whether a speaker was recognised, never the hint or the last sentence', async () => {
      let logs = '';
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          logs += chunk.toString();
          callback();
        },
      });
      const { viSession, post } = await setup({
        gateway: guessing({ label: 'new', hint: 'secret-hint' }),
        logger: { level: 'info', stream },
      });
      await post('alice', viSession.id, {
        knownSpeakers: [{ label: 'speaker_1', hint: 'hint-x', lastText: 'last-text-x' }],
      });
      expect(logs).toContain('"speakerKnown":false');
      for (const secret of ['secret-hint', 'hint-x', 'last-text-x']) {
        expect(logs).not.toContain(secret);
      }
    });
  });
});
