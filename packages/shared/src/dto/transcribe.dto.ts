import { z } from 'zod';

/** Longest base64 payload of one utterance: about 25 s of 16 kHz 16-bit mono PCM. */
export const TRANSCRIBE_MAX_PCM_CHARS = 1_400_000;

/**
 * One utterance from a meeting whose language is recognised in the cloud (ADR 0014).
 * `pcm` is 16-bit little-endian mono PCM at 16 kHz, base64. Never log it.
 */
export const TranscribeRequestSchema = z
  .object({
    segmentId: z.uuid(),
    stream: z.enum(['system', 'mic']),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
    sampleRate: z.literal(16000),
    pcm: z.base64().max(TRANSCRIBE_MAX_PCM_CHARS),
    /** Text of the last recognised sentences of this meeting, oldest first: context only, never stored. */
    previous: z.array(z.string().max(400)).max(3).optional(),
  })
  .strict()
  .refine((value) => value.endMs >= value.startMs, {
    message: 'endMs must not be before startMs',
    path: ['endMs'],
  });
export type TranscribeRequest = z.infer<typeof TranscribeRequestSchema>;

export const TranscribeResponseSchema = z
  .object({
    segmentId: z.uuid(),
    /** May be empty when the utterance held no speech. */
    text: z.string(),
  })
  .strict();
export type TranscribeResponse = z.infer<typeof TranscribeResponseSchema>;
