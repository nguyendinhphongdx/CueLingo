import { z } from 'zod';

/** The signed-in person: what the web account page and the desktop account card show. */
export const MeSchema = z
  .object({
    id: z.uuid(),
    email: z.string(),
    name: z.string(),
    createdAt: z.iso.datetime(),
  })
  .strict();
export type Me = z.infer<typeof MeSchema>;

export const UpdateMeRequestSchema = z.object({ name: z.string().trim().min(1).max(80) }).strict();
export type UpdateMeRequest = z.infer<typeof UpdateMeRequestSchema>;

/** Closing the account removes the person and everything of theirs: they must type this to confirm. */
export const DELETE_ACCOUNT_CONFIRMATION = 'XOA TAI KHOAN';

export const DeleteAccountRequestSchema = z
  .object({ confirm: z.literal(DELETE_ACCOUNT_CONFIRMATION) })
  .strict();
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;
