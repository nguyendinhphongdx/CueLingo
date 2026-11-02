import type { AdminMetrics } from '@cuelingo/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../../testing';
import { createInMemoryAdminRepository } from './admin.repository.memory';

const USER_ID = '6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const metrics: AdminMetrics = {
  generatedAt: '2026-11-02T00:00:00.000Z',
  activeUsers7d: 7,
  meetings: {
    last7Days: { count: 4, totalHours: 3.5 },
    last30Days: { count: 12, totalHours: 10 },
  },
  debriefLatencyMinutes: { median: 1.2, p95: 2.5 },
  aiCostPerMeetingHourUsd: 0.08,
  reviewSessions14d: Array.from({ length: 14 }, (_, index) => {
    const date = new Date('2026-10-20T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), count: index };
  }),
  debriefSuccessRate: 0.75,
};

describe('GET /v1/admin/metrics', () => {
  const apps: Array<Awaited<ReturnType<typeof buildTestApp>>> = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('denies every user when ADMIN_EMAILS is empty', async () => {
    const app = await buildTestApp({
      repos: { admin: createInMemoryAdminRepository({ [USER_ID]: 'owner@example.com' }) },
    });
    apps.push(app);
    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/metrics',
      headers: { 'x-test-user-id': USER_ID },
    });
    expect(response.statusCode).toBe(403);
  });

  it('matches email case-insensitively and returns aggregate-only data', async () => {
    const app = await buildTestApp({
      repos: {
        admin: createInMemoryAdminRepository({ [USER_ID]: 'Owner@Example.com' }, metrics),
      },
      adminEmails: ['owner@example.COM'],
    });
    apps.push(app);
    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/metrics',
      headers: { 'x-test-user-id': USER_ID },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(metrics);
    expect(response.body).not.toMatch(/owner|example\.com|transcript/i);
  });
});
