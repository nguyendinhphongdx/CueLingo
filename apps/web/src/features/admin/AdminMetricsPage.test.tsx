import type { AdminMetrics } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminMetricsView } from './AdminMetricsPage';

const dates = Array.from({ length: 14 }, (_, index) => {
  const date = new Date('2026-10-20T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + index);
  return { date: date.toISOString().slice(0, 10), count: index };
});

const metrics: AdminMetrics = {
  generatedAt: '2026-11-02T08:00:00.000Z',
  activeUsers7d: 18,
  meetings: {
    last7Days: { count: 12, totalHours: 9.5 },
    last30Days: { count: 42, totalHours: 31.25 },
  },
  debriefLatencyMinutes: { median: 1.1, p95: 2.3 },
  aiCostPerMeetingHourUsd: 0.042,
  reviewSessions14d: dates,
  debriefSuccessRate: 0.86,
  beta: {
    medianMinutesToFirstCaption: 4.5,
    meetingsPerUserWeek: 1.5,
    d1: 0.6,
    d7: null,
    feedback30d: 3,
  },
};

describe('AdminMetricsView', () => {
  it('renders aggregate metrics and a compact accessible 14-day table', () => {
    const markup = renderToStaticMarkup(<AdminMetricsView metrics={metrics} />);
    expect(markup).toContain('Số liệu nội bộ');
    expect(markup).toContain('Chi phí AI / giờ họp');
    expect(markup).toContain('Debrief p95');
    expect(markup).toContain('<caption class="sr-only">');
    expect(markup.match(/scope="row"/g) ?? []).toHaveLength(14);
    expect(markup).not.toMatch(/email|transcript/i);
  });

  it('shows the beta numbers and says so when there is not enough data (AC8)', () => {
    const markup = renderToStaticMarkup(<AdminMetricsView metrics={metrics} />);
    expect(markup).toContain('Từ cài tới caption đầu');
    expect(markup).toContain('4,5 phút');
    expect(markup).toContain('60%');
    // d7 is null in the sample: no number, a plain note instead of 0%.
    expect(markup).toContain('Chưa đủ dữ liệu');
    expect(markup).toMatch(/D7<\/dt><dd[^>]*><span[^>]*>Chưa đủ dữ liệu/);
    expect(markup).toContain('Phản hồi · 30 ngày');
  });
});
