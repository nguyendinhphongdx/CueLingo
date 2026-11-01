/**
 * Auth module — Better Auth (ADR-0008). Exposes /api/auth/* routes and the
 * resolver that turns a session cookie into request.userId.
 * Design: apps/docs/docs/04-modules/03-api/auth.md
 */
import type { Config } from '../../config';
import { createAuth } from './auth';
import { createMailer, type Mailer } from './auth.mailer';
import { authRoutes, sessionUserId } from './auth.routes';

export function createAuthModule(config: Config, mailer: Mailer = createMailer(config)) {
  const auth = createAuth(config, mailer);
  return { auth, routes: authRoutes(auth), resolveUserId: sessionUserId(auth) };
}

export type { Mailer } from './auth.mailer';
