import type { Progress } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { Card, CardContent } from '@cuelingo/ui/components/card';
import { Section } from '@cuelingo/ui/components/section';
import { useProgress } from './use-progress';
import { useLanguage } from '../settings';

const chartColor = 'var(--primary)';

const dateLabel = (value: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('vi-VN', { ...options, timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  );

function BarChart({
  values,
  labels,
  ariaLabel,
  decimals = 0,
}: {
  values: number[];
  labels: string[];
  ariaLabel: string;
  decimals?: number;
}) {
  const maxValue = Math.max(1, ...values);
  const tickStep = Math.max(1, Math.ceil(maxValue / 3));
  const scaleMax = tickStep * 3;
  const plot = { left: 42, right: 390, top: 16, bottom: 142 };
  const slot = (plot.right - plot.left) / values.length;
  const ticks = [0, tickStep, tickStep * 2, scaleMax];

  return (
    <svg viewBox="0 0 410 178" className="h-auto w-full" role="img" aria-label={ariaLabel}>
      {ticks.map((tick) => {
        const y = plot.bottom - (tick / scaleMax) * (plot.bottom - plot.top);
        return (
          <g key={tick}>
            <line
              x1={plot.left}
              y1={y}
              x2={plot.right}
              y2={y}
              className="stroke-border"
              strokeWidth="1"
            />
            <text
              x={plot.left - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[11px]"
            >
              {tick.toFixed(decimals)}
            </text>
          </g>
        );
      })}
      {values.map((value, index) => {
        const height = (value / scaleMax) * (plot.bottom - plot.top);
        const width = Math.min(30, slot * 0.56);
        const x = plot.left + index * slot + (slot - width) / 2;
        return (
          <g key={`${labels[index]}-${index}`}>
            <rect
              x={x}
              y={plot.bottom - height}
              width={width}
              height={height}
              rx="2"
              fill={chartColor}
            >
              <title>{`${labels[index]}: ${value.toFixed(decimals)}`}</title>
            </rect>
            <text
              x={x + width / 2}
              y="164"
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {labels[index]}
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
  const dailyValues = progress.reviewsLast7Days.map((item) => item.count);
  const weeklyValues = progress.weekly.map((item) =>
    item.meetings === 0 ? 0 : Number((item.lookups / item.meetings).toFixed(1)),
  );
  const dailyLabels = progress.reviewsLast7Days.map((item) =>
    dateLabel(item.date, { weekday: 'short' }),
  );
  const weeklyLabels = progress.weekly.map((item) =>
    dateLabel(item.weekStart, { day: '2-digit', month: '2-digit' }),
  );
  const hasReviewActivity = dailyValues.some((value) => value > 0);
  const hasMeetingActivity = progress.weekly.some((item) => item.meetings > 0);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground max-w-2xl text-sm leading-6">
        Nhìn lại nhịp học sau các cuộc họp và mức hỗ trợ bạn cần theo thời gian.
      </p>

      <Section title="Tổng quan">
        <dl className="bg-card grid grid-cols-2 overflow-hidden rounded-lg border sm:grid-cols-3">
          {stats.map(([label, value], index) => (
            <div
              key={label}
              className={`min-w-0 p-4 ${index % 3 !== 0 ? 'sm:border-l' : ''} ${index >= 3 ? 'border-t' : ''} ${index % 2 !== 0 ? 'max-sm:border-l' : ''} ${index >= 2 ? 'max-sm:border-t' : ''}`}
            >
              <dt className="text-muted-foreground text-sm">{label}</dt>
              <dd className="mt-1 text-2xl font-medium tracking-tight tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Section title="Ôn tập trong 7 ngày">
          <Card className="gap-0 rounded-lg py-5 shadow-none">
            <CardContent>
              {hasReviewActivity ? (
                <BarChart
                  values={dailyValues}
                  labels={dailyLabels}
                  ariaLabel={`Số lượt ôn 7 ngày: ${progress.reviewsLast7Days.map((item) => `${item.date} ${item.count} lượt`).join(', ')}`}
                />
              ) : (
                <ChartEmptyState>
                  Chưa có lượt ôn trong 7 ngày qua. Các buổi ôn sẽ xuất hiện ở đây sau khi bạn lưu
                  cụm từ.
                </ChartEmptyState>
              )}
            </CardContent>
          </Card>
        </Section>

        <Section
          title="Số lần tra từ mỗi cuộc họp"
          description="Trung bình theo tuần; số thấp dần nghĩa là bạn cần ít hỗ trợ hơn."
        >
          <Card className="gap-0 rounded-lg py-5 shadow-none">
            <CardContent>
              {hasMeetingActivity ? (
                <BarChart
                  values={weeklyValues}
                  labels={weeklyLabels}
                  decimals={1}
                  ariaLabel={`Số lần tra từ trung bình mỗi cuộc họp trong 4 tuần: ${progress.weekly.map((item, index) => `tuần ${item.weekStart} có ${weeklyValues[index]} lần, ${item.lookups} lượt tra trong ${item.meetings} cuộc họp`).join('; ')}`}
                />
              ) : (
                <ChartEmptyState>
                  Chưa có cuộc họp trong 4 tuần qua. Sau cuộc họp đầu tiên, biểu đồ sẽ cho thấy mức
                  hỗ trợ bạn đã dùng.
                </ChartEmptyState>
              )}
            </CardContent>
          </Card>
        </Section>
      </div>
    </div>
  );
}

function ChartEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-44 items-center rounded-md border border-dashed px-5">
      <p className="text-muted-foreground max-w-md text-sm leading-6">{children}</p>
    </div>
  );
}

export function ProgressPage() {
  const { progress, loading, error, retry } = useProgress(useLanguage().language);
  if (loading) return <p className="text-muted-foreground text-sm">Đang tải tiến độ…</p>;
  if (error)
    return (
      <div className="rounded-lg border p-5">
        <p role="alert" className="text-sm">
          {error}
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void retry()}>
          Thử lại
        </Button>
      </div>
    );
  if (!progress) return null;
  return <ProgressView progress={progress} />;
}
