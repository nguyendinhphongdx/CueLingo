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

/** Beta gate numbers. Any of them is null while there is not enough data to compute it. */
const BetaMetricsSchema = z
  .object({
    /** Median over people of (first caption seen − first app launch), in minutes. */
    medianMinutesToFirstCaption: z.number().nonnegative().nullable(),
    /** Meetings started in the last 7 days per person who has launched the app. */
    meetingsPerUserWeek: z.number().nonnegative().nullable(),
    /** Share of people launched ≥ 2 days ago who started a meeting 24–48 h after their first launch. */
    d1: z.number().min(0).max(1).nullable(),
    /** Same, 7–8 days after the first launch, for people launched ≥ 8 days ago. */
    d7: z.number().min(0).max(1).nullable(),
    feedback30d: z.number().int().nonnegative(),
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
    beta: BetaMetricsSchema,
  })
  .strict();

export type AdminMetrics = z.infer<typeof AdminMetricsSchema>;
