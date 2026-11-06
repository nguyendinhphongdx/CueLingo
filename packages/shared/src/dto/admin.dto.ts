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

/** Permissions a plugin may declare (mirrors `AgentPermission` of `@cuelingo/agent`, which shared cannot import). */
export const AgentPermissionSchema = z.enum([
  'phrases:read',
  'phrases:write',
  'lookup',
  'cards',
  'html',
]);

/** One assistant plugin as the admin screen sees it. No user data. */
export const AdminAgentPluginSchema = z
  .object({
    id: z.string().min(1).max(64),
    version: z.string().min(1).max(32),
    /** `failed`: setup threw or a name clashed. `disabled`: switched off by an admin or by the circuit breaker. */
    state: z.enum(['loaded', 'failed', 'disabled']),
    permissions: z.array(AgentPermissionSchema),
    /** Tool names the plugin declares, whatever its state. */
    tools: z.array(z.string().min(1).max(64)),
    disabledBy: z.enum(['admin', 'breaker']).optional(),
    /** When the circuit breaker lets the plugin try again. */
    retryAt: z.iso.datetime().optional(),
  })
  .strict();

export const AdminAgentStatusSchema = z
  .object({
    /** The admin's global switch (in memory, back to on after a restart). */
    enabled: z.boolean(),
    /** Whether the deploy allows the assistant at all (env `AGENT_ENABLED` and an AI key). Not changeable here. */
    available: z.boolean(),
    plugins: z.array(AdminAgentPluginSchema),
  })
  .strict();

/** Either the global switch or one plugin's switch per request. */
export const UpdateAdminAgentRequestSchema = z
  .object({
    enabled: z.boolean().optional(),
    plugin: z
      .object({ id: z.string().min(1).max(64), enabled: z.boolean() })
      .strict()
      .optional(),
  })
  .strict()
  .refine((value) => (value.enabled === undefined) !== (value.plugin === undefined), {
    message: 'Send either enabled or plugin',
  });

export type AdminAgentPlugin = z.infer<typeof AdminAgentPluginSchema>;
export type AdminAgentStatus = z.infer<typeof AdminAgentStatusSchema>;
export type UpdateAdminAgentRequest = z.infer<typeof UpdateAdminAgentRequestSchema>;
