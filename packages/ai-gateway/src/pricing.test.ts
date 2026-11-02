import { describe, expect, it } from 'vitest';
import type { AiCallRecord } from './gateway';
import { estimateCostUsd } from './pricing';

const record = (model: string): AiCallRecord => ({
  task: 'translate.realtime',
  model,
  promptVersion: 'translate.realtime@v1',
  latencyMs: 120,
  inputTokens: 2_000_000,
  outputTokens: 1_000_000,
  fallback: false,
  ok: true,
});

describe('estimateCostUsd', () => {
  it('prices input and output tokens independently', () => {
    expect(estimateCostUsd(record('gemini-3.1-flash-lite'))).toBe(2);
  });

  it('returns null for an unknown model', () => {
    expect(estimateCostUsd(record('unknown-model'))).toBeNull();
  });
});
