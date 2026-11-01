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
  ].map((date, index) => ({ date, count: index })),
  weekly: [
    { weekStart: '2026-10-05', meetings: 2, lookups: 8 },
    { weekStart: '2026-10-12', meetings: 2, lookups: 6 },
    { weekStart: '2026-10-19', meetings: 1, lookups: 2 },
    { weekStart: '2026-10-26', meetings: 0, lookups: 0 },
  ],
};

describe('ProgressView', () => {
  it('shows all metrics and two charts with screen-reader descriptions', () => {
    const markup = renderToStaticMarkup(<ProgressView progress={progress} />);

    for (const label of [
      'Cụm đã lưu',
      'Đang ôn',
      'Đến hạn hôm nay',
      'Chuỗi ngày',
      'Cuộc họp',
      'Hiểu trung bình',
    ]) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain('aria-label="Số lượt ôn 7 ngày:');
    expect(markup).toContain('aria-label="Số lần tra từ trung bình mỗi cuộc họp trong 4 tuần:');
    expect(markup.match(/<svg/g)).toHaveLength(2);
  });

  it('replaces empty charts with useful empty states', () => {
    const empty: Progress = {
      ...progress,
      phrasesSaved: 0,
      phrasesInReview: 0,
      dueToday: 0,
      streakDays: 0,
      meetingsCount: 0,
      avgComprehensionPct: null,
      reviewsLast7Days: progress.reviewsLast7Days.map((item) => ({ ...item, count: 0 })),
      weekly: progress.weekly.map((item) => ({ ...item, meetings: 0, lookups: 0 })),
    };
    const markup = renderToStaticMarkup(<ProgressView progress={empty} />);

    expect(markup).toContain('Chưa có lượt ôn trong 7 ngày qua');
    expect(markup).toContain('Chưa có cuộc họp trong 4 tuần qua');
    expect(markup).not.toContain('<svg');
    expect(markup).toContain('Chưa có');
  });
});
