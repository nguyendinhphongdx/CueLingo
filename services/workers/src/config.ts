import { PlanLimitsOverrideSchema, resolvePlanLimits, type PlanLimitTable } from '@cuelingo/shared';
import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  /** Same variable and format as the API (`PLAN_LIMITS`): a debrief skipped by quota must agree with the API. */
  PLAN_LIMITS: z
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
        ctx.addIssue({ code: 'custom', message: 'PLAN_LIMITS is not valid' });
        return z.NEVER;
      }
      return resolvePlanLimits(parsed.data);
    })
    .default(() => resolvePlanLimits()),
  /** Comma-separated emails with no limits, same as the API's `ADMIN_EMAILS`. */
  ADMIN_EMAILS: z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    )
    .default([]),
});

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigError extends Error {}

/** The only place in the worker that reads environment variables; fails fast and names the variable. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const present = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== undefined && v !== ''),
  );
  const result = ConfigSchema.safeParse(present);
  if (!result.success) {
    const problems = result.error.issues.map(
      (i) => `${i.path.join('.') || 'config'}: ${i.message}`,
    );
    throw new ConfigError(`Invalid environment: ${problems.join('; ')}`);
  }
  return result.data;
}
