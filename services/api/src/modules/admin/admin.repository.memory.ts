import type { AdminMetrics } from '@cuelingo/shared';
import type { AdminRepository } from './admin.repository';

const emptyMetrics = (now: Date): AdminMetrics => ({
  generatedAt: now.toISOString(),
  activeUsers7d: 0,
  meetings: {
    last7Days: { count: 0, totalHours: 0 },
    last30Days: { count: 0, totalHours: 0 },
  },
  debriefLatencyMinutes: { median: null, p95: null },
  aiCostPerMeetingHourUsd: null,
  reviewSessions14d: Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - (13 - index));
    return { date: date.toISOString().slice(0, 10), count: 0 };
  }),
  debriefSuccessRate: null,
});

export function createInMemoryAdminRepository(
  emails: Readonly<Record<string, string>> = {},
  value?: AdminMetrics,
): AdminRepository {
  return {
    async emailForUser(userId) {
      return emails[userId] ?? null;
    },
    async metrics(now) {
      return value ?? emptyMetrics(now);
    },
  };
}
