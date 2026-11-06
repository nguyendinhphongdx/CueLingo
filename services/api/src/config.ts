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
    /** Turns the assistant on or off for everyone. Off (or no GEMINI_API_KEY) answers 503 AGENT_DISABLED. */
    AGENT_ENABLED: z.enum(['true', 'false']).default('true'),
    /**
     * Lets the assistant write small interactive pages (tool `render_html`, prompt agent/v2). They only run in the
     * sandbox runner (infra/sandbox-runner, its own origin): turn this on together with the web app's
     * NEXT_PUBLIC_AGENT_HTML_BLOCKS and NEXT_PUBLIC_SANDBOX_ORIGIN. Default off. See ADR 0019.
     */
    AGENT_HTML_BLOCKS: z.enum(['true', 'false']).default('false'),
    /** Model of the assistant (task `agent.chat`). The gateway reads it itself; listed here so it is documented and checked. */
    AI_AGENT_MODEL: z.string().min(1).optional(),
    /** Daily allowance per person (UTC day). */
    AGENT_QUOTA_TURNS_PER_DAY: z.coerce.number().int().min(0).default(60),
    AGENT_QUOTA_TOKENS_PER_DAY: z.coerce.number().int().min(0).default(400_000),
    AGENT_QUOTA_USD_PER_DAY: z.coerce.number().min(0).default(0.25),
    REALTIME_DEV_TOKEN: z.string().min(16).optional(),
    REALTIME_DEV_USER_ID: z.uuid().optional(),
    /** Sign-up needs an invite code. Defaults to on in production and off elsewhere. */
    INVITES_REQUIRED: z.enum(['true', 'false']).optional(),
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

export type Config = Omit<
  z.infer<typeof ConfigSchema>,
  'INVITES_REQUIRED' | 'AGENT_ENABLED' | 'AGENT_HTML_BLOCKS'
> & {
  INVITES_REQUIRED: boolean;
  AGENT_ENABLED: boolean;
  AGENT_HTML_BLOCKS: boolean;
};

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
  const data = result.data;
  return {
    ...data,
    AGENT_ENABLED: data.AGENT_ENABLED === 'true',
    AGENT_HTML_BLOCKS: data.AGENT_HTML_BLOCKS === 'true',
    INVITES_REQUIRED: data.INVITES_REQUIRED
      ? data.INVITES_REQUIRED === 'true'
      : data.NODE_ENV === 'production',
  };
}
