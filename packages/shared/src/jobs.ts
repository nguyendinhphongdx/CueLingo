import { z } from 'zod';

/** Background jobs: the API enqueues, services/workers handles. One catalog so both sides agree. */
export const JobName = {
  RetentionSweep: 'retention.sweep',
  DebriefGenerate: 'debrief.generate',
  SessionsCloseStale: 'sessions.close-stale',
} as const;
export type JobName = (typeof JobName)[keyof typeof JobName];

export const JobPayloads = {
  [JobName.RetentionSweep]: z.object({}),
  [JobName.DebriefGenerate]: z.object({ sessionId: z.uuid() }),
  [JobName.SessionsCloseStale]: z.object({}),
} as const satisfies Record<JobName, z.ZodType>;

export type JobPayload<N extends JobName> = z.infer<(typeof JobPayloads)[N]>;

/** How a job is deduplicated when sent: one live job per key within the window. */
export interface JobEnqueueOptions {
  singletonKey?: string;
  singletonSeconds?: number;
}

/** A debrief already queued for a session absorbs repeat requests for this long. */
export const DEBRIEF_DEDUPE_SECONDS = 60;

/** Single source of the dedupe rule for `debrief.generate`: the API (end, regenerate) and the worker (stale sweep). */
export const debriefJobOptions = (sessionId: string): JobEnqueueOptions => ({
  singletonKey: `debrief:${sessionId}`,
  singletonSeconds: DEBRIEF_DEDUPE_SECONDS,
});
