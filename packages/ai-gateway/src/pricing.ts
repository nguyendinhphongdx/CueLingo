import type { AiCallRecord } from './gateway';

export interface ModelPrice {
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
}

/**
 * Google Gemini API paid-tier text pricing, USD per 1M tokens.
 * Source: https://ai.google.dev/gemini-api/docs/pricing (checked 2026-11-02).
 * Recheck this table when a routed model or provider price changes.
 */
export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  'gemini-3.1-flash-lite': {
    inputUsdPerMillionTokens: 0.25,
    outputUsdPerMillionTokens: 1.5,
  },
  'gemini-3.5-flash-lite': {
    inputUsdPerMillionTokens: 0.25,
    outputUsdPerMillionTokens: 1.5,
  },
};

/** Returns null when the model is not priced; missing usage is treated as zero tokens. */
export function estimateCostUsd(record: AiCallRecord): number | null {
  const price = MODEL_PRICES[record.model];
  if (!price) return null;
  return (
    ((record.inputTokens ?? 0) * price.inputUsdPerMillionTokens +
      (record.outputTokens ?? 0) * price.outputUsdPerMillionTokens) /
    1_000_000
  );
}
