import { z } from 'zod';

/** Crockford base32 without separators: what the admin hands out and a tester types. */
export const INVITE_CODE_LENGTH = 12;
const INVITE_CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{12}$/;

/** Accepts the code as people type it: any case, spaces or dashes in between. */
export const normalizeInviteCode = (raw: string): string =>
  raw.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');

export const InviteCodeSchema = z
  .string()
  .max(40)
  .transform(normalizeInviteCode)
  .pipe(z.string().regex(INVITE_CODE_PATTERN));

/** Asks the API to remember a code for the sign-in that follows (it sets the `cl_invite` cookie). */
export const InviteIntentRequestSchema = z.object({ code: InviteCodeSchema }).strict();
export type InviteIntentRequest = z.infer<typeof InviteIntentRequestSchema>;

export const CreateInviteRequestSchema = z
  .object({
    maxUses: z.number().int().min(1).max(100).default(1),
    expiresInDays: z.number().int().min(1).max(365).default(30),
    note: z.string().trim().max(100).nullable().default(null),
  })
  .strict();
export type CreateInviteRequest = z.output<typeof CreateInviteRequestSchema>;
export type CreateInviteInput = z.input<typeof CreateInviteRequestSchema>;

/** A listed invite never carries the code: only its hash is stored. */
export const InviteSchema = z.object({
  id: z.uuid(),
  note: z.string().nullable(),
  maxUses: z.number().int(),
  usedCount: z.number().int(),
  expiresAt: z.iso.datetime(),
  revokedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type Invite = z.infer<typeof InviteSchema>;

export const InviteListSchema = z.object({ items: z.array(InviteSchema) });
export type InviteList = z.infer<typeof InviteListSchema>;

/** The only response that holds the plain code, returned once when it is created. */
export const CreatedInviteSchema = InviteSchema.extend({ code: z.string() });
export type CreatedInvite = z.infer<typeof CreatedInviteSchema>;

/** Name of the query parameter the web login reads after Better Auth refuses a sign-up. */
export const INVITE_INVALID_AUTH_ERROR = 'invite_invalid';
/** The cookie that carries a checked code from `/login` to the sign-in callback. */
export const INVITE_COOKIE = 'cl_invite';
