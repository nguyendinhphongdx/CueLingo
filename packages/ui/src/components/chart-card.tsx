'use client';

import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '../lib/utils';

export interface ChartSeries {
  /** Key of the number in each row of `data`. */
  key: string;
  label: string;
}

export interface ChartCardProps {
  title: string;
  description?: ReactNode;
  /** One object per x position, such as `{date: '2026-11-01', newUsers: 3}`. */
  data: ReadonlyArray<Record<string, string | number>>;
  /** Key of the x position (a day or a month). */
  xKey: string;
  /** Heading of the x column in the table for screen readers. Default "Ngày". */
  xLabel?: string;
  series: ChartSeries[];
  /** Text for an x value on the axis and in the table. Default: as is. */
  formatX?: (value: string) => string;
  /** Text for a number in the tooltip and in the table. Default: as is. */
  formatValue?: (value: number) => string;
  className?: string;
}

/** The color of series `index`, from the design tokens. */
const COLORS = ['var(--chart-1)', 'var(--chart-2)'];
const color = (index: number) => COLORS[index % COLORS.length]!;

/**
 * The same data as a table that only screen readers see: the chart itself is a picture, so this is what
 * assistive technology (and the tests) read.
 */
function DataTable({
  title,
  data,
  xKey,
  xLabel = 'Ngày',
  series,
  formatX = String,
  formatValue = String,
}: Pick<
  ChartCardProps,
  'title' | 'data' | 'xKey' | 'xLabel' | 'series' | 'formatX' | 'formatValue'
>) {
  return (
    <table className="sr-only">
      <caption>{title}</caption>
      <thead>
        <tr>
          <th scope="col">{xLabel}</th>
          {series.map((s) => (
            <th key={s.key} scope="col">
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={String(row[xKey])}>
            <th scope="row">{formatX(String(row[xKey]))}</th>
            {series.map((s) => (
              <td key={s.key}>{formatValue(Number(row[s.key] ?? 0))}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Frame({
  title,
  description,
  className,
  children,
  ...table
}: ChartCardProps & { children: ReactNode }) {
  return (
    <section
      className={cn(
        'bg-card text-card-foreground flex flex-col gap-3 rounded-xl border p-4 shadow-sm',
        className,
      )}
    >
      <header>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
      </header>
      <div aria-hidden="true" className="h-60 w-full">
        {children}
      </div>
      <DataTable title={title} {...table} />
    </section>
  );
}

const axis = { stroke: 'var(--muted-foreground)', fontSize: 11, tickLine: false } as const;
const tooltipStyle = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
};

/** A line per series over time (new people per day). */
export function LineChartCard(props: ChartCardProps) {
  const { data, xKey, series, formatX = String, formatValue = String } = props;
  return (
    <Frame {...props}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[...data]} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey={xKey}
            tickFormatter={(v) => formatX(String(v))}
            minTickGap={24}
            {...axis}
          />
          <YAxis allowDecimals={false} tickFormatter={(v) => formatValue(Number(v))} {...axis} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(v) => formatX(String(v))}
            formatter={(v) => formatValue(Number(v))}
          />
          {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={color(i)}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/** A bar per x position and series (revenue per day or month). */
export function BarChartCard(props: ChartCardProps) {
  const { data, xKey, series, formatX = String, formatValue = String } = props;
  return (
    <Frame {...props}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...data]} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey={xKey}
            tickFormatter={(v) => formatX(String(v))}
            minTickGap={24}
            {...axis}
          />
          <YAxis allowDecimals={false} tickFormatter={(v) => formatValue(Number(v))} {...axis} />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
            contentStyle={tooltipStyle}
            labelFormatter={(v) => formatX(String(v))}
            formatter={(v) => formatValue(Number(v))}
          />
          {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={color(i)}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}
