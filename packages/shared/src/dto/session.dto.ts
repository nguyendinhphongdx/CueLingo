import { z } from 'zod';
import { EnabledLanguageSchema, LanguageCodeSchema } from '../languages';
import { SpeakerSchema } from './speaker.dto';

/** A meeting session: created by the desktop app, ended when the user stops, debriefed by a worker. */
export const SessionStatusSchema = z.enum(['live', 'ended', 'debriefed', 'deleted']);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const CreateSessionRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    assistLevel: z.number().int().min(0).max(5),
    /** The language spoken in this meeting. Missing means the default language. */
    language: EnabledLanguageSchema.optional(),
  })
  .strict();
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

/** Switches the language spoken in a meeting that is already running (the speakers changed language). */
export const UpdateSessionLanguageRequestSchema = z
  .object({ language: EnabledLanguageSchema })
  .strict();
export type UpdateSessionLanguageRequest = z.infer<typeof UpdateSessionLanguageRequestSchema>;

export const SessionSchema = z
  .object({
    id: z.uuid(),
    title: z.string().nullable(),
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime().nullable(),
    status: SessionStatusSchema,
    assistLevel: z.number().int(),
    language: LanguageCodeSchema,
  })
  .strict();
export type Session = z.infer<typeof SessionSchema>;

export const StoredSegmentSchema = z
  .object({
    id: z.uuid(),
    source: z.enum(['system', 'mic']),
    startMs: z.number().int(),
    endMs: z.number().int(),
    textEn: z.string(),
    textVi: z.string().nullable(),
    /** Null or missing: the speaker was not told apart (shown from `source`). */
    speakerId: z.uuid().nullable().optional(),
  })
  .strict();
export type StoredSegment = z.infer<typeof StoredSegmentSchema>;

export const SessionDetailSchema = SessionSchema.extend({
  segments: z.array(StoredSegmentSchema),
  speakers: z.array(SpeakerSchema).default([]),
}).strict();
export type SessionDetail = z.infer<typeof SessionDetailSchema>;

export const SessionListSchema = z.object({ sessions: z.array(SessionSchema) }).strict();
export type SessionList = z.infer<typeof SessionListSchema>;

/** `POST /v1/sessions/:id/debrief` (202): the debrief job is queued (or already waiting). */
export const DebriefQueuedSchema = z.object({ queued: z.literal(true) }).strict();
export type DebriefQueued = z.infer<typeof DebriefQueuedSchema>;
