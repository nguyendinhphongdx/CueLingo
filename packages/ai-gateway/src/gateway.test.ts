import {
  ComposeResponseSchema,
  DebriefContentSchema,
  LookupResponseSchema,
} from '@cuelingo/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiGatewayError, createAiGateway, type AiCallRecord, type GenerateFn } from './gateway';
import { TASKS } from './tasks';

const make = (generate: GenerateFn, calls: AiCallRecord[] = []) =>
  createAiGateway({ googleApiKey: 'test', generate, onCall: (c) => calls.push(c) });

describe('ai-gateway translate.realtime', () => {
  it('returns the primary model output and records one call', async () => {
    const calls: AiCallRecord[] = [];
    const gw = make(async () => ({ text: ' Xin chào ', inputTokens: 10, outputTokens: 3 }), calls);
    const out = await gw.llm('translate.realtime', { text: 'Hello' });
    expect(out).toMatchObject({ text: 'Xin chào', fallback: false });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      task: 'translate.realtime',
      ok: true,
      promptVersion: 'translate.realtime@v1',
    });
  });

  it('falls back to the second model when the first fails', async () => {
    const calls: AiCallRecord[] = [];
    const generate = vi
      .fn<GenerateFn>()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ text: 'Chào' });
    const out = await make(generate, calls).llm('translate.realtime', { text: 'Hello' });
    expect(out.fallback).toBe(true);
    expect(generate.mock.calls[0]![0].model).not.toBe(generate.mock.calls[1]![0].model);
    expect(calls.map((c) => c.ok)).toEqual([false, true]);
  });

  it('throws AiGatewayError when both models fail or answer empty', async () => {
    await expect(
      make(async () => ({ text: '  ' })).llm('translate.realtime', { text: 'Hi' }),
    ).rejects.toBeInstanceOf(AiGatewayError);
  });

  it('passes an abort signal so slow calls can time out', async () => {
    const generate = vi.fn<GenerateFn>(async ({ signal }) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      return { text: 'ok' };
    });
    await make(generate).llm('translate.realtime', { text: 'Hi' });
    expect(generate).toHaveBeenCalled();
  });

  it('passes attribution context to the hook without letting hook failures affect the call', async () => {
    const onCall = vi.fn(() => {
      throw new Error('metrics store unavailable');
    });
    const gateway = createAiGateway({
      googleApiKey: 'test',
      generate: async () => ({ text: 'Xin chào' }),
      onCall,
    });
    await expect(
      gateway.llm(
        'translate.realtime',
        { text: 'Hello' },
        {
          userId: 'user-1',
          sessionId: 'session-1',
        },
      ),
    ).resolves.toMatchObject({ text: 'Xin chào' });
    await vi.waitFor(() =>
      expect(onCall).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', sessionId: 'session-1' }),
      ),
    );
  });
});

describe('ai-gateway structured assist tasks', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('routes all assist tasks to the configured model with an 8 second timeout', () => {
    for (const task of ['assist.lookup', 'assist.recap', 'assist.compose'] as const) {
      expect(TASKS[task]).toMatchObject({ model: 'gemini-3.5-flash-lite', timeoutMs: 8_000 });
    }
  });

  it('honors AI_ASSIST_MODEL for every assist task', async () => {
    vi.stubEnv('AI_ASSIST_MODEL', 'custom-assist-model');
    vi.resetModules();
    const { TASKS: configuredTasks } = await import('./tasks');
    expect(configuredTasks['assist.lookup'].model).toBe('custom-assist-model');
    expect(configuredTasks['assist.recap'].model).toBe('custom-assist-model');
    expect(configuredTasks['assist.compose'].model).toBe('custom-assist-model');
  });

  it('parses and validates JSON with the supplied schema', async () => {
    const generate = vi.fn<GenerateFn>(async () => ({
      text: JSON.stringify({ term: 'table', meaningVi: 'hoãn', exampleEn: 'Let us table it.' }),
    }));
    const output = await make(generate).json(
      'assist.lookup',
      { term: 'table', context: 'Let us table it.' },
      LookupResponseSchema,
    );
    expect(output.meaningVi).toBe('hoãn');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('retries once after invalid JSON or schema output', async () => {
    const generate = vi
      .fn<GenerateFn>()
      .mockResolvedValueOnce({ text: '{bad json' })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          options: [{ en: 'Could you clarify?' }, { en: 'Would you explain?' }],
        }),
      });
    const output = await make(generate).json(
      'assist.compose',
      { intentVi: 'Bạn giải thích rõ hơn được không?' },
      ComposeResponseSchema,
    );
    expect(output.options).toHaveLength(2);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1]![0].prompt).toContain('previous response was invalid');
  });

  it('throws AiGatewayError after two invalid responses', async () => {
    const generate = vi.fn<GenerateFn>(async () => ({ text: '{}' }));
    await expect(
      make(generate).json('assist.lookup', { term: 'table' }, LookupResponseSchema),
    ).rejects.toBeInstanceOf(AiGatewayError);
    expect(generate).toHaveBeenCalledTimes(2);
  });
});

describe('ai-gateway debrief.generate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses the debrief model, timeout and output schema', async () => {
    expect(TASKS['debrief.generate']).toMatchObject({
      model: 'gemini-3.5-flash-lite',
      timeoutMs: 60_000,
    });
    const generate = vi.fn<GenerateFn>(async () => ({
      text: JSON.stringify({
        summary: { headlineVi: 'Kế hoạch phát hành', bulletsVi: [] },
        actionItems: [],
        hardSegmentIds: [],
        phraseSuggestions: [],
        rephrase: [],
        comprehensionPct: null,
      }),
    }));

    const output = await make(generate).json(
      'debrief.generate',
      {
        segments: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            source: 'system',
            textEn: 'We will ship Friday.',
          },
        ],
      },
      DebriefContentSchema,
    );

    expect(output.summary.headlineVi).toBe('Kế hoạch phát hành');
    expect(generate.mock.calls[0]![0].prompt).toContain('We will ship Friday.');
  });

  it('honors AI_DEBRIEF_MODEL', async () => {
    vi.stubEnv('AI_DEBRIEF_MODEL', 'custom-debrief-model');
    vi.resetModules();
    const { TASKS: configuredTasks } = await import('./tasks');
    expect(configuredTasks['debrief.generate'].model).toBe('custom-debrief-model');
  });
});

describe('speech', () => {
  const wav = new Uint8Array([82, 73, 70, 70, 1, 0, 0, 0, 87, 65, 86, 69, 1, 2, 3]);

  it('reads text aloud with the lite model and records the call', async () => {
    const speak = vi.fn(async () => ({ audio: wav, mimeType: 'audio/wav' as const }));
    const onCall = vi.fn();
    const gateway = createAiGateway({ googleApiKey: 'k', speak, onCall });

    const result = await gateway.speech('Can we push back the deadline?', {}, { userId: 'u1' });

    expect(result).toMatchObject({ audio: wav, mimeType: 'audio/wav', fallback: false });
    expect(speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Can we push back the deadline?', voice: 'Kore' }),
    );
    await Promise.resolve();
    expect(onCall).toHaveBeenCalledWith(
      expect.objectContaining({ task: 'tts.speak', ok: true, userId: 'u1' }),
    );
  });

  it('falls back to the second model when the first fails', async () => {
    const speak = vi
      .fn()
      .mockRejectedValueOnce(new Error('overloaded'))
      .mockResolvedValueOnce({ audio: wav, mimeType: 'audio/wav' });
    const gateway = createAiGateway({ googleApiKey: 'k', speak });

    const result = await gateway.speech('hello');
    expect(result.fallback).toBe(true);
    expect(speak.mock.calls[0]![0].model).not.toBe(speak.mock.calls[1]![0].model);
  });

  it('fails with a gateway error when both models fail or return no audio', async () => {
    const gateway = createAiGateway({
      googleApiKey: 'k',
      speak: async () => ({ audio: new Uint8Array(), mimeType: 'audio/wav' as const }),
    });
    await expect(gateway.speech('hello')).rejects.toMatchObject({ task: 'tts.speak' });
  });
});
