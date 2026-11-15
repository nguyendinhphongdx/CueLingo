import { PlanLimitsEnvSchema } from '@cuelingo/shared';
import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  /** Same variable and format as the API (`PLAN_LIMITS`): a debrief skipped by quota must agree with the API. */
  PLAN_LIMITS: PlanLimitsEnvSchema,
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
