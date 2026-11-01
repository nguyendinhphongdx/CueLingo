import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';
import { Pool } from 'pg';
import type { Config } from '../../config';
import type { Mailer } from './auth.mailer';

/**
 * Better Auth owns identity tables (user, session, account, verification).
 * Our domain keys off user.id; learner_profiles gets one row per user on sign-up.
 */
export function createAuth(config: Config, mailer: Mailer) {
  const pool = new Pool({ connectionString: config.DATABASE_URL });

  return betterAuth({
    database: pool,
    secret: config.BETTER_AUTH_SECRET,
    baseURL: config.BETTER_AUTH_URL,
    trustedOrigins: [config.WEB_ORIGIN],
    // Tables are prefixed auth_ so they never read as our meeting tables (sessions).
    user: { modelName: 'auth_user' },
    session: { modelName: 'auth_session' },
    account: { modelName: 'auth_account' },
    verification: { modelName: 'auth_verification' },
    socialProviders:
      config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: config.GOOGLE_CLIENT_ID,
              clientSecret: config.GOOGLE_CLIENT_SECRET,
            },
          }
        : {},
    plugins: [magicLink({ sendMagicLink: ({ email, url }) => mailer.sendMagicLink(email, url) })],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await pool.query(
              'INSERT INTO learner_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
              [user.id],
            );
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
