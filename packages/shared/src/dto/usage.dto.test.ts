import { describe, expect, it } from 'vitest';
import { SetPlanRequestSchema, UsageResponseSchema } from './usage.dto';

const item = { used: 1, limit: null, resetsAt: '2026-12-01T00:00:00.000Z', state: 'ok' };

describe('UsageResponseSchema', () => {
  it('needs all five metrics', () => {
    const usage = {
      translation_ms: item,
      cloud_stt_ms: item,
      debriefs: item,
      assist_daily: item,
      agent_messages: item,
    };
    expect(UsageResponseSchema.safeParse({ plan: 'free', usage }).success).toBe(true);
    const { debriefs: _d, ...rest } = usage;
    expect(UsageResponseSchema.safeParse({ plan: 'free', usage: rest }).success).toBe(false);
  });
});

describe('SetPlanRequestSchema', () => {
  it('accepts a known plan and rejects extras', () => {
    expect(SetPlanRequestSchema.safeParse({ email: 'a@b.co', plan: 'pro' }).success).toBe(true);
    expect(SetPlanRequestSchema.safeParse({ email: 'a@b.co', plan: 'gold' }).success).toBe(false);
    expect(
      SetPlanRequestSchema.safeParse({ email: 'a@b.co', plan: 'pro', userId: 'x' }).success,
    ).toBe(false);
  });
});
