import { DEFAULT_LANGUAGE, INVITE_INVALID_AUTH_ERROR } from '@cuelingo/shared';
import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';
import type { Pool } from 'pg';
import type { Config } from '../../config';
import { MAGIC_LINK_MINUTES } from './auth.email';
import type { Mailer } from './auth.mailer';
import { inviteCodeFromCookie, type InviteGate } from '../invites';

/**
 * Better Auth owns identity tables (user, session, account, verification).
 * Our domain keys off user.id; learner_profiles gets one row per user on sign-up.
 */
export function createAuth(config: Config, mailer: Mailer, pool: Pool, invites?: InviteGate) {
  // Invite uses spent by the sign-up gate wait here (by email) until the user row exists and can be linked.
  const spent = new Map<string, string>();
  return betterAuth({
    database: pool,
    secret: config.BETTER_AUTH_SECRET,
    baseURL: config.BETTER_AUTH_URL,
    trustedOrigins: [config.WEB_ORIGIN],
    // Our id columns are uuid: have Better Auth generate UUIDs instead of its default random strings.
    advanced: { database: { generateId: 'uuid' } },
    // Tables are prefixed auth_ so they never read as our meeting tables (sessions).
    user: {
      modelName: 'auth_user',
      // One gate for every way of signing up (email link, Google, and so the desktop app, which signs in
      // through the web). Existing users never reach 'create-user', so they are not asked for a code.
      validateUserInfo: invites?.required
        ? async ({ user, source }, ctx) => {
            if (source.action !== 'create-user') return;
            const headers = ctx.request?.headers ?? ctx.headers;
            const cookie = headers instanceof Headers ? headers.get('cookie') : undefined;
            const inviteId = await invites.redeem(inviteCodeFromCookie(cookie));
            if (!inviteId) return { error: INVITE_INVALID_AUTH_ERROR };
            if (typeof user.email === 'string') spent.set(user.email.toLowerCase(), inviteId);
          }
        : undefined,
    },
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
    // Magic links can be abused to spam a mailbox: five per hour and address in production.
    rateLimit: {
      // Tests sign in dozens of people from one address in seconds.
      enabled: config.NODE_ENV !== 'test',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/magic-link': { window: 3600, max: config.NODE_ENV === 'production' ? 5 : 100 },
      },
    },
    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_MINUTES * 60,
        sendMagicLink: ({ email, url }) => mailer.sendMagicLink(email, url),
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const inviteId = spent.get(user.email.toLowerCase());
            if (inviteId) {
              spent.delete(user.email.toLowerCase());
              await invites?.recordRedemption(inviteId, user.id);
            }
            await pool.query(
              'INSERT INTO learner_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
              [user.id],
            );
            await pool.query(
              'INSERT INTO learner_languages (user_id, language) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [user.id, DEFAULT_LANGUAGE],
            );
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
