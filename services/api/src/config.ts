import { z } from 'zod';

const ConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.url(),
    /** Origin of apps/web: allowed by CORS and trusted by Better Auth. */
    WEB_ORIGIN: z.url().default('http://localhost:3000'),
    /** Public URL of this API (Better Auth builds callback and magic links from it). */
    BETTER_AUTH_URL: z.url().default('http://localhost:4000'),
    BETTER_AUTH_SECRET: z.string().min(32),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    /** How sign-in emails leave the server: `console` only prints them and is for local development. */
    MAIL_PROVIDER: z.enum(['console', 'resend', 'smtp']).default('console'),
    /** Sender shown to people, e.g. `CueLingo <login@your-domain.com>`; the domain must be verified with the provider. */
    MAIL_FROM: z.string().min(3).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    /** SMTP connection, e.g. `smtps://user:password@smtp.example.com:465`. */
    SMTP_URL: z.string().min(1).optional(),
    /** Where generated speech is kept; defaults to a folder in the system temp directory. */
    TTS_CACHE_DIR: z.string().min(1).optional(),
    GEMINI_API_KEY: z.string().min(1).optional(),
    REALTIME_DEV_TOKEN: z.string().min(16).optional(),
    REALTIME_DEV_USER_ID: z.uuid().optional(),
    /** Comma-separated internal dashboard allowlist. Empty or absent denies everyone. */
    ADMIN_EMAILS: z
      .string()
      .transform((value) =>
        value
          .split(',')
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      )
      .default([]),
  })
  .refine((c) => c.MAIL_PROVIDER !== 'resend' || Boolean(c.RESEND_API_KEY && c.MAIL_FROM), {
    message: 'MAIL_PROVIDER=resend needs RESEND_API_KEY and MAIL_FROM',
    path: ['RESEND_API_KEY'],
  })
  .refine((c) => c.MAIL_PROVIDER !== 'smtp' || Boolean(c.SMTP_URL && c.MAIL_FROM), {
    message: 'MAIL_PROVIDER=smtp needs SMTP_URL and MAIL_FROM',
    path: ['SMTP_URL'],
  })
  .refine((c) => c.NODE_ENV !== 'production' || c.MAIL_PROVIDER !== 'console', {
    message:
      'production needs a real MAIL_PROVIDER (resend or smtp): sign-in links must be emailed',
    path: ['MAIL_PROVIDER'],
  })
  .refine((c) => Boolean(c.GOOGLE_CLIENT_ID) === Boolean(c.GOOGLE_CLIENT_SECRET), {
    message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together',
    path: ['GOOGLE_CLIENT_ID'],
  });

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigError extends Error {}

/**
 * The only place that reads environment variables. Fails fast and names every
 * offending variable, so a bad deploy stops at startup instead of at first use.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // `FOO=` in a .env file means "not set", not an empty value.
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
