import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { AdminActivity, AdminOverview, AdminRevenue, AdminUsage } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { adminActiveId, ADMIN_GROUP } from '../admin-nav';
import { AdminActivityView } from './AdminMetricsPage';
import { AdminOverviewView } from './AdminOverviewPage';
import { AdminRevenueView } from './AdminRevenuePage';
import { AdminUsageView } from './AdminUsagePage';
import { AnalyticsFrame } from './AnalyticsFrame';
import { quotaFromParams } from './AdminUsersPage';
import { queryFor } from './use-admin-users';

const days = (n: number, extra: object) =>
  Array.from({ length: n }, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, '0')}`,
    ...extra,
  }));
const AT = '2026-11-16T05:00:00.000Z';

const overview: AdminOverview = {
  generatedAt: AT,
  totalUsers: 12,
  newUsers: { d7: 3, d30: 5 },
  activeUsers: { d1: 2, d7: 6, d30: 9 },
  byPlan: { free: 9, pro: 2, ultra: 1 },
  revenueThisMonth: 300000,
  expiringIn7d: 1,
  daily: days(30, { newUsers: 0, activeUsers: 0 }) as AdminOverview['daily'],
};
const revenue: AdminRevenue = {
  generatedAt: AT,
  daily: days(30, { amount: 0 }) as AdminRevenue['daily'],
  monthly: Array.from({ length: 12 }, (_, i) => ({
    month: `2026-${String(i + 1).padStart(2, '0')}`,
    amount: i === 11 ? 99000 : 0,
  })),
  byPlanPeriod: [
    { plan: 'pro', period: 'month', orders: 2, amount: 198000 },
    { plan: 'pro', period: 'year', orders: 0, amount: 0 },
    { plan: 'ultra', period: 'month', orders: 0, amount: 0 },
    { plan: 'ultra', period: 'year', orders: 0, amount: 0 },
  ],
  ordersByStatus: { pending: 1, paid: 2, expired: 0, cancelled: 0 },
  paidRate: null,
  adminGrants: 4,
};
const metric = (m: AdminUsage['metrics'][number]['metric'], over = {}) => ({
  metric: m,
  total: 0,
  averageByPlan: { free: 0, pro: null, ultra: null },
  atLeast80: 2,
  atLeast100: 1,
  ...over,
});
const usage: AdminUsage = {
  generatedAt: AT,
  periodStart: '2026-10-31T17:00:00.000Z',
  metrics: [
    metric('translation_ms', { total: 7_200_000 }),
    metric('cloud_stt_ms'),
    metric('debriefs', { atLeast80: null, atLeast100: null }),
    metric('agent_messages'),
  ],
  aiCostUsdThisMonth: null,
};
const activity: AdminActivity = {
  generatedAt: AT,
  metrics: {
    generatedAt: AT,
    activeUsers7d: 1,
    meetings: { last7Days: { count: 1, totalHours: 1 }, last30Days: { count: 2, totalHours: 2 } },
    debriefLatencyMinutes: { median: null, p95: null },
    aiCostPerMeetingHourUsd: null,
    reviewSessions14d: days(14, { count: 0 }) as AdminActivity['metrics']['reviewSessions14d'],
    debriefSuccessRate: null,
    beta: {
      medianMinutesToFirstCaption: null,
      meetingsPerUserWeek: null,
      d1: null,
      d7: null,
      feedback30d: 0,
    },
  },
  daily: days(30, { meetings: 1, hours: 0.5 }) as AdminActivity['daily'],
  meetingUsers: { dau: 1, wau: 2, mau: 3 },
};
const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe('admin console pages', () => {
  it('overview shows every number of the spec and a 30-row chart table', () => {
    const out = html(<AdminOverviewView overview={overview} />);
    for (const text of [
      'Tổng người dùng',
      'Người mới · 7 ngày',
      'Người mới · 30 ngày',
      'Hoạt động · 1 ngày',
      'Hoạt động · 7 ngày',
      'Hoạt động · 30 ngày',
      'Free',
      'Pro',
      'Ultra',
      'Doanh thu tháng này',
      'hết hạn · 7 ngày tới',
    ]) {
      expect(out).toContain(text);
    }
    expect(out.match(/scope="row"/g)).toHaveLength(30);
    expect(out).not.toContain('@');
  });

  it('revenue says "Chưa đủ dữ liệu" for a null paid rate, not 0%, and keeps 4 plan-period rows', () => {
    const out = html(<AdminRevenueView revenue={revenue} />);
    expect(out).toContain('Chưa đủ dữ liệu');
    expect(out).not.toMatch(/>0%</);
    expect(out).toContain('Lần admin tặng gói');
    // 30 + 12 chart rows + 4 plan-period rows.
    expect(out.match(/scope="row"/g)).toHaveLength(46);
  });

  it('usage links to the filtered user list and says "Không áp dụng" where a limit does not apply', () => {
    const out = html(<AdminUsageView usage={usage} />);
    expect(out).toContain('href="/admin/users?metric=translation_ms&amp;atLeast=80"');
    expect(out).toContain('href="/admin/users?metric=agent_messages&amp;atLeast=100"');
    expect(out).not.toContain('metric=debriefs&amp;atLeast');
    expect(out).toContain('Không áp dụng');
    expect(out).toContain('Chưa đủ dữ liệu');
  });

  it('activity adds DAU/WAU/MAU and the 30-day charts to the numbers of /admin/metrics', () => {
    const out = html(<AdminActivityView activity={activity} />);
    for (const text of [
      'DAU',
      'WAU',
      'MAU',
      'Cuộc họp theo ngày',
      'Giờ họp theo ngày',
      'Beta',
      'Debrief p95',
    ]) {
      expect(out).toContain(text);
    }
  });

  it('every page has the time the numbers were worked out and a reload button', () => {
    const out = html(
      <AnalyticsFrame
        title="T"
        description="D"
        generatedAt={AT}
        loading={false}
        error={null}
        onReload={() => {}}
        reloading={false}
      >
        x
      </AnalyticsFrame>,
    );
    expect(out).toContain('Cập nhật lúc');
    expect(out).toContain('Số liệu làm mới mỗi phút');
    expect(out).toContain('Tải lại');
  });

  it('shows an error with a reload button, and a loading line', () => {
    const props = { title: 'T', description: 'D', onReload: () => {}, reloading: false };
    expect(html(<AnalyticsFrame {...props} loading error={null} />)).toContain('Đang tải số liệu');
    const failed = html(<AnalyticsFrame {...props} loading={false} error="Lỗi" />);
    expect(failed).toContain('role="alert"');
    expect(failed).toContain('Tải lại');
  });
});

describe('admin console structure (AC11)', () => {
  const root = join(__dirname, '..', '..');
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });

  it('has no AdminFrame or AdminNav left, and no admin page renders its own <main>', () => {
    const sources = walk(join(root, 'features')).filter(
      (f) => /\.tsx?$/.test(f) && !f.endsWith('.test.tsx'),
    );
    for (const file of sources) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/AdminFrame|AdminNav\b/);
    }
    for (const file of walk(join(root, 'features', 'admin')).filter(
      (f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'),
    )) {
      expect(readFileSync(file, 'utf8'), file).not.toContain('<main');
    }
  });

  it('keeps every admin route inside the (app) group, so AppShell wraps it', () => {
    expect(statSync(join(root, 'app', 'admin'), { throwIfNoEntry: false })).toBeUndefined();
    const pages = walk(join(root, 'app', '(app)', 'admin')).filter((f) => f.endsWith('page.tsx'));
    expect(pages.length).toBeGreaterThanOrEqual(7);
  });

  it('maps every admin path to one entry of the sidebar group', () => {
    expect(ADMIN_GROUP.items.map((i) => i.webPath)).toEqual([
      '/admin',
      '/admin/users',
      '/admin/revenue',
      '/admin/usage',
      '/admin/metrics',
      '/admin/agent',
      '/admin/invites',
    ]);
    expect(adminActiveId('/admin')).toBe('admin-overview');
    expect(adminActiveId('/admin/')).toBe('admin-overview');
    expect(adminActiveId('/admin/users/abc')).toBe('admin-users');
    expect(adminActiveId('/admin/metrics')).toBe('admin-activity');
    expect(adminActiveId('/sessions')).toBe('');
  });
});

describe('quota filter from the address', () => {
  it('reads a valid pair and ignores a broken one', () => {
    expect(quotaFromParams(new URLSearchParams('metric=debriefs&atLeast=80'))).toEqual({
      metric: 'debriefs',
      atLeast: '80',
    });
    expect(quotaFromParams(new URLSearchParams('metric=debriefs'))).toBeNull();
    expect(quotaFromParams(new URLSearchParams('metric=assist_daily&atLeast=80'))).toBeNull();
    expect(quotaFromParams(new URLSearchParams(''))).toBeNull();
  });

  it('sends the pair with the other filters', () => {
    expect(queryFor({ q: '', plan: 'pro', quota: { metric: 'debriefs', atLeast: '100' } })).toEqual(
      { plan: 'pro', metric: 'debriefs', atLeast: '100' },
    );
  });
});
