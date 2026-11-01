import { z } from 'zod';

/** Desktop sign-in: web mints a one-time code, the app exchanges it for a device token. */
export const DeviceCodeResponseSchema = z
  .object({ code: z.string().min(20), expiresInSeconds: z.number().int() })
  .strict();
export type DeviceCodeResponse = z.infer<typeof DeviceCodeResponseSchema>;

export const DeviceExchangeRequestSchema = z
  .object({
    code: z.string().min(20).max(200),
    /** Shown in the list of signed-in devices, e.g. "CueLingo cho macOS". */
    label: z.string().trim().max(80).optional(),
  })
  .strict();
export type DeviceExchangeRequest = z.infer<typeof DeviceExchangeRequestSchema>;

export const DeviceExchangeResponseSchema = z.object({ token: z.string().min(20) }).strict();
export type DeviceExchangeResponse = z.infer<typeof DeviceExchangeResponseSchema>;

export const DeviceTokenSchema = z
  .object({
    id: z.uuid(),
    label: z.string().nullable(),
    createdAt: z.iso.datetime(),
    lastUsedAt: z.iso.datetime().nullable(),
  })
  .strict();
export type DeviceToken = z.infer<typeof DeviceTokenSchema>;

export const DeviceTokenListSchema = z.object({ devices: z.array(DeviceTokenSchema) }).strict();
export type DeviceTokenList = z.infer<typeof DeviceTokenListSchema>;

/** Prefix of every device token, so a leaked one is recognisable in logs and secret scanners. */
export const DEVICE_TOKEN_PREFIX = 'cld_';
