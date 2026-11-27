import { z } from 'zod';

/** Plans and quota rules. Pure: no I/O, so the API and the worker share one source of truth. */

export const PlanSchema = z.enum(['free', 'pro', 'ultra']);
export type Plan = z.infer<typeof PlanSchema>;
export const DEFAULT_PLAN: Plan = 'free';

/**
 * Units: `*_ms` are milliseconds of audio/speech; the others are counts.
 * Monthly metrics reset on day 1 (Vietnam time); the `*_daily` ones reset each Vietnam day.
 */
export const USAGE_METRICS = [
  'translation_ms',
  'cloud_stt_ms',
  'debriefs',
  'assist_daily',
  'agent_messages',
  'lessons_daily',
  'lesson_practice_daily',
  'meeting_ask_daily',
] as const;
export const UsageMetricSchema = z.enum(USAGE_METRICS);
export type UsageMetric = z.infer<typeof UsageMetricSchema>;

const HOUR_MS = 3_600_000;

/** `null` = unlimited. Business model: apps/docs/docs/02-product/05-business-model.md */
export type PlanLimitTable = Record<Plan, Record<UsageMetric, number | null>>;
export const DEFAULT_PLAN_LIMITS: PlanLimitTable = {
  free: {
    translation_ms: 2 * HOUR_MS,
    cloud_stt_ms: 1 * HOUR_MS,
    debriefs: 8,
    assist_daily: 20,
    agent_messages: 0,
    lessons_daily: 2,
    lesson_practice_daily: 20,
    meeting_ask_daily: 10,
  },
  pro: {
    translation_ms: 20 * HOUR_MS,
    cloud_stt_ms: 10 * HOUR_MS,
    debriefs: null,
    assist_daily: null,
    agent_messages: 100,
    lessons_daily: 10,
    lesson_practice_daily: 150,
    meeting_ask_daily: 60,
  },
  ultra: {
    translation_ms: 60 * HOUR_MS,
    cloud_stt_ms: 30 * HOUR_MS,
    debriefs: null,
    assist_daily: null,
    agent_messages: 500,
    lessons_daily: 20,
    lesson_practice_daily: 300,
    meeting_ask_daily: 150,
  },
};

const LimitValueSchema = z.number().int().min(0).nullable();
const PlanOverrideSchema = z
  .object({
    translation_ms: LimitValueSchema,
    cloud_stt_ms: LimitValueSchema,
    debriefs: LimitValueSchema,
    assist_daily: LimitValueSchema,
    agent_messages: LimitValueSchema,
    lessons_daily: LimitValueSchema,
    lesson_practice_daily: LimitValueSchema,
    meeting_ask_daily: LimitValueSchema,
  })
  .partial()
  .strict();

/** Value of the `PLAN_LIMITS` env var: a partial override of {@link DEFAULT_PLAN_LIMITS}. */
export const PlanLimitsOverrideSchema = z
  .object({ free: PlanOverrideSchema, pro: PlanOverrideSchema, ultra: PlanOverrideSchema })
  .partial()
  .strict();
export type PlanLimitsOverride = z.infer<typeof PlanLimitsOverrideSchema>;

export function resolvePlanLimits(override: PlanLimitsOverride = {}): PlanLimitTable {
  const out = structuredClone(DEFAULT_PLAN_LIMITS);
  for (const plan of PlanSchema.options) {
    Object.assign(out[plan], override[plan] ?? {});
  }
  return out;
}

/**
 * The `PLAN_LIMITS` environment variable: JSON text in, resolved limit table out; absent means the defaults.
 * API and workers both use this schema, so a bad value stops either one at start-up with the same message.
 */
export const PlanLimitsEnvSchema = z
  .string()
  .transform((value, ctx): PlanLimitTable => {
    let json: unknown;
    try {
      json = JSON.parse(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'PLAN_LIMITS must be valid JSON' });
      return z.NEVER;
    }
    const parsed = PlanLimitsOverrideSchema.safeParse(json);
    if (!parsed.success) {
      const problems = parsed.error.issues.map(
        (i) => `${i.path.join('.') || 'value'}: ${i.message}`,
      );
      ctx.addIssue({
        code: 'custom',
        message: `PLAN_LIMITS is not valid (${problems.join('; ')})`,
      });
      return z.NEVER;
    }
    return resolvePlanLimits(parsed.data);
  })
  .default(() => resolvePlanLimits());

/** Vietnam is UTC+7 with no daylight saving. */
const VN_OFFSET_MS = 7 * HOUR_MS;
const DAY_MS = 24 * HOUR_MS;

export function isDailyMetric(metric: UsageMetric): boolean {
  return metric.endsWith('_daily');
}

/** Start of the quota period containing `now`, as a UTC instant. */
export function periodStart(metric: UsageMetric, now: Date): Date {
  const local = new Date(now.getTime() + VN_OFFSET_MS);
  if (isDailyMetric(metric)) {
    const day = Math.floor(local.getTime() / DAY_MS) * DAY_MS;
    return new Date(day - VN_OFFSET_MS);
  }
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - VN_OFFSET_MS);
}

/** Start of the next period: when the counter starts from zero again. */
export function periodEnd(metric: UsageMetric, now: Date): Date {
  const start = periodStart(metric, now);
  if (isDailyMetric(metric)) return new Date(start.getTime() + DAY_MS);
  const local = new Date(start.getTime() + VN_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - VN_OFFSET_MS);
}

export const UsageStateSchema = z.enum(['ok', 'low', 'exhausted']);
export type UsageState = z.infer<typeof UsageStateSchema>;

const LOW_TRANSLATION_MS = 10 * 60_000;

/** Warn when 10 minutes of translation or 10% of any other allowance is left. */
export function quotaState(metric: UsageMetric, used: number, limit: number | null): UsageState {
  if (limit === null) return 'ok';
  if (used >= limit) return 'exhausted';
  const left = limit - used;
  if (metric === 'translation_ms') return left <= LOW_TRANSLATION_MS ? 'low' : 'ok';
  return left <= limit * 0.1 ? 'low' : 'ok';
}

const MAX_SEGMENT_MS = 60_000;
const MIN_MS_PER_CHAR = 40;

/** Translation time billed for one segment: its length, floored by text length so a client cannot hide it. */
export function translationCostMs(startMs: number, endMs: number, text: string): number {
  const span = Math.min(Math.max(endMs - startMs, 0), MAX_SEGMENT_MS);
  return Math.round(Math.max(span, text.length * MIN_MS_PER_CHAR));
}
