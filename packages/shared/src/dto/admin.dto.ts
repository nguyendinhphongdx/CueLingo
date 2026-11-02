import { z } from 'zod';

const MeetingWindowSchema = z
  .object({
    count: z.number().int().nonnegative(),
    totalHours: z.number().nonnegative(),
  })
  .strict();

const ReviewDaySchema = z
  .object({
    date: z.iso.date(),
    count: z.number().int().nonnegative(),
  })
  .strict();

/** Aggregate-only operational metrics. This contract deliberately contains no identifiers. */
export const AdminMetricsSchema = z
  .object({
    generatedAt: z.iso.datetime(),
    activeUsers7d: z.number().int().nonnegative(),
    meetings: z
      .object({
        last7Days: MeetingWindowSchema,
        last30Days: MeetingWindowSchema,
      })
      .strict(),
    debriefLatencyMinutes: z
      .object({
        median: z.number().nonnegative().nullable(),
        p95: z.number().nonnegative().nullable(),
      })
      .strict(),
    aiCostPerMeetingHourUsd: z.number().nonnegative().nullable(),
    reviewSessions14d: z.array(ReviewDaySchema).length(14),
    debriefSuccessRate: z.number().min(0).max(1).nullable(),
  })
  .strict();

export type AdminMetrics = z.infer<typeof AdminMetricsSchema>;
