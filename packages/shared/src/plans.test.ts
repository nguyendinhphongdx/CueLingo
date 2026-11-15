import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAN_LIMITS,
  PlanLimitsEnvSchema,
  PlanLimitsOverrideSchema,
  periodEnd,
  periodStart,
  quotaState,
  resolvePlanLimits,
  translationCostMs,
} from './plans';

describe('period boundaries (UTC+7)', () => {
  it('starts the month on day 1 Vietnam time', () => {
    // 2026-11-30T20:00Z is already 2026-12-01 03:00 in Vietnam.
    const now = new Date('2026-11-30T20:00:00Z');
    expect(periodStart('translation_ms', now).toISOString()).toBe('2026-11-30T17:00:00.000Z');
    expect(periodEnd('translation_ms', now).toISOString()).toBe('2026-12-31T17:00:00.000Z');
  });

  it('keeps the previous month until 17:00 UTC on the last day', () => {
    const now = new Date('2026-11-30T16:59:00Z');
    expect(periodStart('debriefs', now).toISOString()).toBe('2026-10-31T17:00:00.000Z');
  });

  it('rolls the year over', () => {
    const now = new Date('2026-12-31T18:00:00Z');
    expect(periodEnd('cloud_stt_ms', now).toISOString()).toBe('2027-01-31T17:00:00.000Z');
  });

  it('uses the Vietnam day for assist_daily', () => {
    const now = new Date('2026-11-14T18:00:00Z'); // 01:00 on the 15th in Vietnam
    expect(periodStart('assist_daily', now).toISOString()).toBe('2026-11-14T17:00:00.000Z');
    expect(periodEnd('assist_daily', now).toISOString()).toBe('2026-11-15T17:00:00.000Z');
  });
});

describe('quotaState', () => {
  it('is ok when unlimited', () => {
    expect(quotaState('debriefs', 1e9, null)).toBe('ok');
  });
  it('is exhausted at the limit, including a limit of 0', () => {
    expect(quotaState('debriefs', 8, 8)).toBe('exhausted');
    expect(quotaState('agent_messages', 0, 0)).toBe('exhausted');
  });
  it('is low with 10 minutes of translation left', () => {
    const limit = DEFAULT_PLAN_LIMITS.free.translation_ms!;
    expect(quotaState('translation_ms', limit - 600_000, limit)).toBe('low');
    expect(quotaState('translation_ms', limit - 600_001, limit)).toBe('ok');
  });
  it('is low with 10% of another allowance left', () => {
    expect(quotaState('debriefs', 7, 8)).toBe('ok');
    expect(quotaState('assist_daily', 17, 20)).toBe('ok');
    expect(quotaState('assist_daily', 18, 20)).toBe('low');
  });
});

describe('plan limits', () => {
  it('matches the business model table', () => {
    expect(DEFAULT_PLAN_LIMITS.free).toEqual({
      translation_ms: 7_200_000,
      cloud_stt_ms: 3_600_000,
      debriefs: 8,
      assist_daily: 20,
      agent_messages: 0,
    });
    expect(DEFAULT_PLAN_LIMITS.ultra.agent_messages).toBe(500);
  });
  it('merges a partial override without touching the defaults', () => {
    const merged = resolvePlanLimits({ free: { debriefs: 1, assist_daily: null } });
    expect(merged.free.debriefs).toBe(1);
    expect(merged.free.assist_daily).toBeNull();
    expect(merged.free.translation_ms).toBe(7_200_000);
    expect(DEFAULT_PLAN_LIMITS.free.debriefs).toBe(8);
  });
  it('rejects an unknown plan or metric', () => {
    expect(PlanLimitsOverrideSchema.safeParse({ gold: {} }).success).toBe(false);
    expect(PlanLimitsOverrideSchema.safeParse({ free: { nope: 1 } }).success).toBe(false);
    expect(PlanLimitsOverrideSchema.safeParse({ free: { debriefs: -1 } }).success).toBe(false);
  });
});

describe('PlanLimitsEnvSchema', () => {
  it('defaults when unset and merges an override', () => {
    expect(PlanLimitsEnvSchema.parse(undefined).free.debriefs).toBe(8);
    expect(PlanLimitsEnvSchema.parse('{"pro":{"agent_messages":7}}').pro.agent_messages).toBe(7);
  });
  it('names PLAN_LIMITS and the exact key that is wrong', () => {
    const bad = PlanLimitsEnvSchema.safeParse('{"free":{"debriefs":-1}}');
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toContain('PLAN_LIMITS');
    expect(bad.error?.issues[0]?.message).toContain('free.debriefs');
    expect(PlanLimitsEnvSchema.safeParse('{oops').error?.issues[0]?.message).toContain(
      'valid JSON',
    );
  });
});

describe('translationCostMs', () => {
  it('clamps the claimed span to 60 s', () => {
    expect(translationCostMs(0, 500_000, 'a')).toBe(60_000);
  });
  it('floors by text length against a lying client', () => {
    expect(translationCostMs(1000, 1000, 'x'.repeat(100))).toBe(4000);
    expect(translationCostMs(5000, 1000, 'hi')).toBe(80);
  });
});
