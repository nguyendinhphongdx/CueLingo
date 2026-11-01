import type { Progress } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProgressView } from './ProgressPage';

const progress: Progress = {
  phrasesSaved: 12,
  phrasesInReview: 8,
  dueToday: 3,
  streakDays: 4,
  meetingsCount: 5,
  avgComprehensionPct: 76,
  reviewsLast7Days: [
    '2026-10-26',
    '2026-10-27',
    '2026-10-28',
    '2026-10-29',
    '2026-10-30',
    '2026-10-31',
    '2026-11-01',
  ].map((date, index) => ({
    date,
    count: index,
  })),
  weekly: [
    { weekStart: '2026-10-05', meetings: 2, lookups: 8 },
    { weekStart: '2026-10-12', meetings: 2, lookups: 6 },
    { weekStart: '2026-10-19', meetings: 1, lookups: 2 },
    { weekStart: '2026-10-26', meetings: 0, lookups: 0 },
  ],
};

describe('ProgressView', () => {
  it('shows every metric and accessible chart descriptions', () => {
    const markup = renderToStaticMarkup(<ProgressView progress={progress} />);
    for (const label of [
      'Cụm đã lưu',
      'Đang ôn',
      'Đến hạn hôm nay',
      'Chuỗi ngày',
      'Cuộc họp',
      'Hiểu trung bình',
    ])
      expect(markup).toContain(label);
    expect(markup).toContain('aria-label="Số lượt ôn 7 ngày:');
    expect(markup).toContain('aria-label="Số lần tra từ trung bình mỗi cuộc họp trong 4 tuần:');
  });
});
