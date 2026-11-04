import { z } from 'zod';

/** How many other people one meeting labels; beyond this everyone else is "Người khác". */
export const MAX_SPEAKERS = 8;

/** A person in a meeting: `me` is the user (microphone), `speaker_1`..`speaker_8` are the others in order of first speaking. */
export const SpeakerLabelSchema = z.string().regex(/^(me|speaker_[1-8])$/);
export type SpeakerLabel = z.infer<typeof SpeakerLabelSchema>;

/** A label of someone other than the user. */
export const OtherSpeakerLabelSchema = z.string().regex(/^speaker_[1-8]$/);
export type OtherSpeakerLabel = z.infer<typeof OtherSpeakerLabelSchema>;

export const SpeakerSchema = z
  .object({
    id: z.uuid(),
    label: SpeakerLabelSchema,
    /** Name the user gave; null shows the default ("Tôi", "Speaker N"). */
    displayName: z.string().nullable(),
  })
  .strict();
export type Speaker = z.infer<typeof SpeakerSchema>;

/** `PATCH /v1/sessions/:id/speakers/:speakerId`. `null` removes the name. */
export const RenameSpeakerRequestSchema = z
  .object({ displayName: z.string().trim().min(1).max(40).nullable() })
  .strict();
export type RenameSpeakerRequest = z.infer<typeof RenameSpeakerRequestSchema>;

export const RenameSpeakerResponseSchema = z.object({ speaker: SpeakerSchema }).strict();
export type RenameSpeakerResponse = z.infer<typeof RenameSpeakerResponseSchema>;
