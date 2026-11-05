/**
 * Auth module — Better Auth (ADR-0008). Exposes /api/auth/* routes and the
 * resolver that turns a session cookie into request.userId.
 * Design: apps/docs/docs/04-modules/03-api/auth.md
 */
import { Pool } from 'pg';
import type { Config } from '../../config';
import { createAuth } from './auth';
import { createMailer, type Mailer } from './auth.mailer';
import { authRoutes, sessionUserId } from './auth.routes';
import type { InviteGate } from '../invites';

export function createAuthModule(
  config: Config,
  mailer: Mailer = createMailer(config),
  invites?: InviteGate,
) {
  // Better Auth talks to Postgres through its own pg pool; the module owns it so shutdown can close it.
  const pool = new Pool({ connectionString: config.DATABASE_URL });
  pool.on('error', (err) => console.error('auth pool', err));
  const auth = createAuth(config, mailer, pool, invites);
  return {
    auth,
    routes: authRoutes(auth),
    resolveUserId: sessionUserId(auth),
    close: () => pool.end(),
  };
}

export type { Mailer } from './auth.mailer';
