import { z } from 'zod';
import { DEFAULT_TTS_VOICE, TtsVoiceSchema } from './tts.dto';

export const AssistDefaultSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(3),
  z.literal(4),
]);

export const OverlaySettingsSchema = z
  .object({
    fontSize: z.number().int().min(14).max(28),
    opacity: z.number().int().min(55).max(100),
    theme: z.enum(['dark', 'light']),
  })
  .strict();

export const UserSettingsSchema = z
  .object({
    assistDefault: AssistDefaultSchema,
    overlay: OverlaySettingsSchema,
    saveAudio: z.boolean(),
    ttsVoice: TtsVoiceSchema,
  })
  .strict();
export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const DEFAULT_USER_SETTINGS: UserSettings = {
  assistDefault: 4,
  overlay: { fontSize: 18, opacity: 88, theme: 'dark' },
  saveAudio: false,
  ttsVoice: DEFAULT_TTS_VOICE,
};

/** A settings patch is shallow except for overlay, whose individual controls update independently. */
export const UpdateUserSettingsSchema = z
  .object({
    assistDefault: AssistDefaultSchema.optional(),
    overlay: OverlaySettingsSchema.partial().strict().optional(),
    saveAudio: z.boolean().optional(),
    ttsVoice: TtsVoiceSchema.optional(),
  })
  .strict();
export type UpdateUserSettings = z.infer<typeof UpdateUserSettingsSchema>;
