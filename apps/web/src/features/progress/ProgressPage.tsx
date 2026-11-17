'use client';

import type { LanguageCode, Progress } from '@cuelingo/shared';
import { Card, CardContent } from '@cuelingo/ui/components/card';
import { EmptyState } from '@cuelingo/ui/components/empty-state';
import { NoticeStrip } from '@cuelingo/ui/components/notice-strip';
import { Skeleton } from '@cuelingo/ui/components/skeleton';
import { StatCard, StatGrid } from '@cuelingo/ui/components/stat-card';
import { Section } from '@cuelingo/ui/components/section';
import { AssistSuggestion } from '../assist-suggestion';
import { useProgress } from './use-progress';

const dateLabel = (value: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('vi-VN', { ...options, timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  );

function BarChart({
  values,
  labels,
  ariaLabel,
}: {
  values: number[];
  labels: string[];
  ariaLabel: string;
}) {
  const max = Math.max(1, ...values);
  const barWidth = 100 / Math.max(1, values.length);
  return (
    <svg viewBox="0 0 400 180" className="h-auto w-full" role="img" aria-label={ariaLabel}>
      <line x1="20" y1="145" x2="390" y2="145" className="stroke-border" />
      {values.map((value, index) => {
        const height = (value / max) * 110;
        const x = 25 + index * barWidth * 3.7;
        return (
          <g key={`${labels[index]}-${index}`}>
            <rect
              x={x}
              y={145 - height}
              width={Math.max(18, barWidth * 2.4)}
              height={height}
              rx="4"
              className="fill-primary"
            >
              <title>{`${labels[index]}: ${value}`}</title>
            </rect>
            <text
              x={x + 12}
              y="164"
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {labels[index]}
            </text>
            <text
              x={x + 12}
              y={Math.max(18, 139 - height)}
              textAnchor="middle"
              className="fill-foreground text-[11px] font-medium"
            >
              {value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function ProgressView({ progress }: { progress: Progress }) {
  const stats = [
    ['Cụm đã lưu', progress.phrasesSaved],
    ['Đang ôn', progress.phrasesInReview],
    ['Đến hạn hôm nay', progress.dueToday],
    ['Chuỗi ngày', `${progress.streakDays} ngày`],
    ['Cuộc họp', progress.meetingsCount],
    [
      'Hiểu trung bình',
      progress.avgComprehensionPct === null
        ? 'Chưa có'
        : `${Math.round(progress.avgComprehensionPct)}%`,
    ],
  ] as const;
  const dailyLabels = progress.reviewsLast7Days.map((item) =>
    dateLabel(item.date, { weekday: 'short' }),
  );
  const dailyValues = progress.reviewsLast7Days.map((item) => item.count);
  const weeklyLabels = progress.weekly.map((item) =>
    dateLabel(item.weekStart, { day: '2-digit', month: '2-digit' }),
  );
  const weeklyValues = progress.weekly.map((item) =>
    item.meetings === 0 ? 0 : Number((item.lookups / item.meetings).toFixed(1)),
  );

  return (
    <>
      <Section title="Tổng quan">
        <StatGrid>
          {stats.map(([label, value]) => (
            <StatCard key={label} label={label} value={value} />
          ))}
        </StatGrid>
      </Section>
      <Section title="Ôn tập trong 7 ngày">
        <Card>
          <CardContent className="pt-6">
            <BarChart
              values={dailyValues}
              labels={dailyLabels}
              ariaLabel={`Số lượt ôn 7 ngày: ${progress.reviewsLast7Days.map((item) => `${item.date} ${item.count} lượt`).join(', ')}`}
            />
          </CardContent>
        </Card>
      </Section>
      <Section title="Số lần tra từ mỗi cuộc họp">
        <Card>
          <CardContent className="pt-6">
            <BarChart
              values={weeklyValues}
              labels={weeklyLabels}
              ariaLabel={`Số lần tra từ trung bình mỗi cuộc họp trong 4 tuần: ${progress.weekly.map((item, index) => `tuần ${item.weekStart} có ${weeklyValues[index]} lần, ${item.lookups} lượt tra trong ${item.meetings} cuộc họp`).join('; ')}`}
            />
            <p className="text-muted-foreground mt-2 text-sm">
              Số thấp dần cho thấy bạn cần ít hỗ trợ hơn.
            </p>
          </CardContent>
        </Card>
      </Section>
    </>
  );
}

/** The Tiến độ tab of Ôn tập: the numbers and charts for one language. */
export function ProgressPanel({ language }: { language: LanguageCode }) {
  const { progress, loading, error } = useProgress(language);
  if (loading)
    return (
      <div className="space-y-3" aria-busy="true">
        <p className="sr-only" aria-live="polite">
          Đang tải tiến độ…
        </p>
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  if (error) return <NoticeStrip tone="error">{error}</NoticeStrip>;
  if (!progress) return <EmptyState title="Chưa có dữ liệu tiến độ" />;
  return (
    <div className="space-y-6">
      <AssistSuggestion language={language} />
      <ProgressView progress={progress} />
    </div>
  );
}
