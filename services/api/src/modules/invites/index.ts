/**
 * Invites module — closed-beta invite codes (spec 2026-11-05-beta-readiness).
 * Design: apps/docs/docs/04-modules/03-api/invites.md
 */
import { INVITE_COOKIE } from '@cuelingo/shared';
import { invitesRoutes } from './invites.routes';
import { createInvitesService } from './invites.service';
import type { InvitesRepository } from './invites.repository';

export function createInvitesModule(
  repo: InvitesRepository,
  isAdmin: (userId: string) => Promise<boolean>,
  options: { secureCookie: boolean },
) {
  const service = createInvitesService(repo, isAdmin);
  return { service, routes: invitesRoutes(service, options) };
}

/** What Better Auth's sign-up gate needs, so the auth module does not import the whole module. */
export interface InviteGate {
  /** When false the gate lets everyone sign up (development and tests). */
  required: boolean;
  redeem(rawCode: unknown): Promise<string | null>;
  recordRedemption(inviteId: string, userId: string): Promise<void>;
}

export function createInviteGate(
  repo: InvitesRepository,
  required: boolean,
  now?: () => Date,
): InviteGate {
  const service = createInvitesService(repo, async () => false, now);
  return { required, redeem: service.redeem, recordRedemption: service.recordRedemption };
}

/** Reads the `cl_invite` cookie out of a Cookie header. */
export function inviteCodeFromCookie(header: string | null | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === INVITE_COOKIE) return value.join('=');
  }
  return undefined;
}

export type { InvitesRepository } from './invites.repository';
export type { InvitesService } from './invites.service';
export { createPostgresInvitesRepository } from './invites.repository';
export { createInMemoryInvitesRepository } from './invites.repository.memory';
export { generateInviteCode, hashInviteCode } from './invites.service';
