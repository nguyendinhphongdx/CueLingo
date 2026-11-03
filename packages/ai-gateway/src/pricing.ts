import type { AiCallRecord } from './gateway';

export interface ModelPrice {
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  /**
   * USD per 1M audio input tokens (Gemini counts 32 tokens per second of audio, so 1 h = 115,200 tokens).
   * Used for `stt.transcribe`, where the prompt tokens reported by the provider are almost all audio.
   */
  audioInputUsdPerMillionTokens?: number;
}

/**
 * Google Gemini API paid-tier text pricing, USD per 1M tokens.
 * Source: https://ai.google.dev/gemini-api/docs/pricing (text checked 2026-11-02; the audio rates were
 * entered 2026-11-03 without a fresh check, so confirm them against `ai_call` cost after the first real meeting).
 * Recheck this table when a routed model or provider price changes.
 */
export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  'gemini-3.1-flash-lite': {
    inputUsdPerMillionTokens: 0.25,
    outputUsdPerMillionTokens: 1.5,
    audioInputUsdPerMillionTokens: 0.5,
  },
  'gemini-3.5-flash-lite': {
    inputUsdPerMillionTokens: 0.25,
    outputUsdPerMillionTokens: 1.5,
    audioInputUsdPerMillionTokens: 0.5,
  },
};

/** Returns null when the model is not priced; missing usage is treated as zero tokens. */
export function estimateCostUsd(record: AiCallRecord): number | null {
  const price = MODEL_PRICES[record.model];
  if (!price) return null;
  const inputRate =
    record.task === 'stt.transcribe'
      ? (price.audioInputUsdPerMillionTokens ?? price.inputUsdPerMillionTokens)
      : price.inputUsdPerMillionTokens;
  return (
    ((record.inputTokens ?? 0) * inputRate +
      (record.outputTokens ?? 0) * price.outputUsdPerMillionTokens) /
    1_000_000
  );
}
