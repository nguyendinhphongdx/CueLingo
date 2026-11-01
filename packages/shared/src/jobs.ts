import { z } from 'zod';

/** Background jobs: the API enqueues, services/workers handles. One catalog so both sides agree. */
export const JobName = {
  RetentionSweep: 'retention.sweep',
  DebriefGenerate: 'debrief.generate',
} as const;
export type JobName = (typeof JobName)[keyof typeof JobName];

export const JobPayloads = {
  [JobName.RetentionSweep]: z.object({}),
  [JobName.DebriefGenerate]: z.object({ sessionId: z.uuid() }),
} as const satisfies Record<JobName, z.ZodType>;

export type JobPayload<N extends JobName> = z.infer<(typeof JobPayloads)[N]>;
