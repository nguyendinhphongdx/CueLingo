/**
 * Auth module — Better Auth (ADR-0008). Exposes /api/auth/* routes and the
 * resolver that turns a session cookie into request.userId.
 * Design: apps/docs/docs/04-modules/03-api/auth.md
 */
import type { Config } from '../../config';
import { createAuth } from './auth';
import { createMailer } from './auth.mailer';
import { authRoutes, sessionUserId } from './auth.routes';

export function createAuthModule(config: Config) {
  const auth = createAuth(config, createMailer(config));
  return { auth, routes: authRoutes(auth), resolveUserId: sessionUserId(auth) };
}

export type { Mailer } from './auth.mailer';
