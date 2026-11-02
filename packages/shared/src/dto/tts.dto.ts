import { z } from 'zod';

/** Longest text the API will read aloud in one request: a phrase or a sentence, not a transcript. */
export const TTS_MAX_CHARS = 300;

export const TtsRequestSchema = z
  .object({ text: z.string().trim().min(1).max(TTS_MAX_CHARS) })
  .strict();
export type TtsRequest = z.infer<typeof TtsRequestSchema>;
