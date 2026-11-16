import { z } from 'zod';

/** Longest text the API will read aloud in one request: a phrase or a sentence, not a transcript. */
export const TTS_MAX_CHARS = 300;

/** Voices a person can pick; the first is the default and what everyone heard before voices existed. */
export const TTS_VOICES = ['Kore', 'Puck', 'Charon', 'Aoede', 'Fenrir', 'Leda'] as const;
export const TtsVoiceSchema = z.enum(TTS_VOICES);
export type TtsVoice = z.infer<typeof TtsVoiceSchema>;
export const DEFAULT_TTS_VOICE: TtsVoice = 'Kore';

/** `voice` is only for trying a voice before saving it; otherwise the server uses the person's setting. */
export const TtsRequestSchema = z
  .object({ text: z.string().trim().min(1).max(TTS_MAX_CHARS), voice: TtsVoiceSchema.optional() })
  .strict();
export type TtsRequest = z.infer<typeof TtsRequestSchema>;
