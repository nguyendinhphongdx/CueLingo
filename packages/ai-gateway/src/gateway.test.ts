import { describe, expect, it, vi } from 'vitest';
import { AiGatewayError, createAiGateway, type AiCallRecord, type GenerateFn } from './gateway';

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
});
