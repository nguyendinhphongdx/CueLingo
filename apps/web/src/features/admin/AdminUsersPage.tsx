'use client';

import {
  AdminUserListQuerySchema,
  DEFAULT_PLAN_LIMITS,
  type AdminDashboard,
  type AdminUserRow,
} from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { Card, CardContent } from '@cuelingo/ui/components/card';
import { FilterCard } from '@cuelingo/ui/components/filter-card';
import { Input } from '@cuelingo/ui/components/input';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { Section } from '@cuelingo/ui/components/section';
import { Skeleton } from '@cuelingo/ui/components/skeleton';
import { StatCard } from '@cuelingo/ui/components/stat-card';
import { UsageMeter } from '@cuelingo/ui/components/usage-meter';
import { EmptyState } from '@cuelingo/ui/components/empty-state';
import { NoticeStrip } from '@cuelingo/ui/components/notice-strip';
import { Badge } from '@cuelingo/ui/components/badge';
import {
  formatDateVn,
  formatDurationMs,
  formatVnd,
  planName,
  usageLabel,
} from '@cuelingo/ui/lib/usage';
import Link from 'next/link';
import { notFound, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { expiryText, sourceLabel } from './admin-users-format';
import {
  useAdminDashboard,
  useAdminUsers,
  useDebounced,
  type PlanFilter,
  type QuotaFilter,
} from './use-admin-users';

const number = new Intl.NumberFormat('vi-VN');

/**
 * The numbers at the top (AC1). Plans count only while they are in force. Without `dashboard` (loading
 * or failed) the people-group cards still show and still filter the list, just without counts (AC15).
 */
export function AdminDashboardView({
  dashboard,
  selected = 'all',
  onSelect,
}: {
  dashboard: AdminDashboard | null;
  /** The filter in force: the card for it is marked as pressed (AC15). */
  selected?: PlanFilter;
  /** Pressing a card that can filter the list; without it the cards are plain numbers. */
  onSelect?: (filter: PlanFilter) => void;
}) {
  const count = (value: number | undefined) => (value === undefined ? null : number.format(value));
  const stats: { label: string; value: string | null; filter?: PlanFilter }[] = [
    { label: 'Tổng người dùng', value: count(dashboard?.totalUsers), filter: 'all' },
    { label: 'Free', value: count(dashboard?.byPlan.free), filter: 'free' },
    { label: 'Pro', value: count(dashboard?.byPlan.pro), filter: 'pro' },
    { label: 'Ultra', value: count(dashboard?.byPlan.ultra), filter: 'ultra' },
    ...(dashboard
      ? [
          { label: 'Đăng ký mới · 7 ngày', value: number.format(dashboard.newUsers7d) },
          { label: 'Doanh thu tháng này', value: formatVnd(dashboard.revenueThisMonth) },
        ]
      : []),
    {
      label: 'Gói trả phí hết hạn · 7 ngày tới',
      value: count(dashboard?.expiringIn7d),
      filter: 'expiring',
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map(({ label, value, filter }) =>
        filter && onSelect ? (
          <FilterCard
            key={label}
            label={label}
            value={value}
            selected={selected === filter}
            onSelect={() => onSelect(filter)}
          />
        ) : (
          <StatCard key={label} label={label} value={value} />
        ),
      )}
    </div>
  );
}

/**
 * Where the month's translation hours stand against the plan's allowance (the table has no other usage).
 * The row DTO carries no limits, so the meter uses `DEFAULT_PLAN_LIMITS`; a per-user override is not reflected here.
 */
export function rowUsage(user: Pick<AdminUserRow, 'plan' | 'translationMsThisMonth'>) {
  const limit = DEFAULT_PLAN_LIMITS[user.plan].translation_ms;
  const used = user.translationMsThisMonth;
  const state: 'ok' | 'low' | 'exhausted' =
    limit !== null && used >= limit
      ? 'exhausted'
      : limit !== null && used >= limit * 0.8
        ? 'low'
        : 'ok';
  return { used, limit, state };
}

/** One row per person (AC2). The email links to the detail page. */
export function AdminUserTable({ users }: { users: AdminUserRow[] }) {
  if (users.length === 0) {
    return (
      <EmptyState
        title="Không có người dùng nào khớp"
        description="Thử bỏ bớt bộ lọc hoặc tìm bằng từ khác."
      />
    );
  }
  const head = 'text-muted-foreground px-4 py-3 text-left font-medium';
  return (
    <Card>
      <CardContent className="overflow-x-auto px-0 py-0">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <caption className="sr-only">Người dùng, mới đăng ký trước</caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className={head}>
                Người dùng
              </th>
              <th scope="col" className={head}>
                Đăng ký
              </th>
              <th scope="col" className={head}>
                Gói
              </th>
              <th scope="col" className={head}>
                Nguồn
              </th>
              <th scope="col" className={head}>
                Hết hạn
              </th>
              <th scope="col" className={head}>
                Giờ dịch tháng này
              </th>
              <th scope="col" className={head}>
                Hoạt động gần nhất
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {user.email}
                  </Link>
                  <span className="text-muted-foreground block text-xs">{user.name}</span>
                </th>
                <td className="px-4 py-3">{formatDateVn(user.createdAt)}</td>
                <td className="px-4 py-3">
                  <Badge variant={user.plan === 'free' ? 'outline' : 'default'}>
                    {planName(user.plan)}
                  </Badge>
                </td>
                <td className="px-4 py-3">{sourceLabel(user.source)}</td>
                <td className="px-4 py-3">{expiryText(user)}</td>
                <td className="w-56 px-4 py-3">
                  <UsageMeter metric="translation_ms" {...rowUsage(user)} />
                  <p className="text-muted-foreground mt-1 text-xs">
                    Đã dùng {formatDurationMs(user.translationMsThisMonth)}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {user.lastActiveAt ? formatDateVn(user.lastActiveAt) : 'Chưa có'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/** The filter in the address (`?metric=debriefs&atLeast=80`), or null when absent or not valid. */
export function quotaFromParams(params: { get(name: string): string | null }): QuotaFilter | null {
  const parsed = AdminUserListQuerySchema.safeParse({
    metric: params.get('metric') ?? undefined,
    atLeast: params.get('atLeast') ?? undefined,
  });
  return parsed.success && parsed.data.metric && parsed.data.atLeast
    ? { metric: parsed.data.metric, atLeast: parsed.data.atLeast }
    : null;
}

export function AdminUsersPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [quota, setQuota] = useState<QuotaFilter | null>(() => quotaFromParams(params));
  const [text, setText] = useState('');
  const [plan, setPlan] = useState<PlanFilter>('all');
  const q = useDebounced(text);
  const dashboard = useAdminDashboard();
  const list = useAdminUsers({ q, plan, quota });
  if (dashboard.hidden || list.hidden) notFound();

  return (
    // Links show once either call has answered without 401/403: that is proof the caller is an admin.
    <>
      <PageHeader
        title="Người dùng và gói"
        description="Ai đang ở gói nào, doanh thu tháng này và gói sắp hết hạn. Chỉ thấy email, gói và lượng dùng, không thấy nội dung cuộc họp."
      />
      <Section title="Tổng quan">
        {dashboard.error && <NoticeStrip tone="error">{dashboard.error}</NoticeStrip>}
        <div aria-busy={dashboard.loading}>
          <AdminDashboardView dashboard={dashboard.dashboard} selected={plan} onSelect={setPlan} />
        </div>
      </Section>
      <div className="mt-8">
        <Section title="Danh sách">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              maxLength={100}
              className="max-w-xs"
              placeholder="Tìm theo email hoặc tên"
              aria-label="Tìm theo email hoặc tên"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            {quota && (
              <span className="bg-muted inline-flex items-center gap-2 rounded-full py-1 pr-1 pl-3 text-sm">
                {quota.atLeast === '100' ? 'Hết' : 'Từ 80% của'} hạn mức {usageLabel(quota.metric)}
                <button
                  type="button"
                  aria-label="Bỏ bộ lọc hạn mức"
                  className="hover:bg-background focus-visible:ring-ring size-6 cursor-pointer rounded-full focus-visible:ring-2 focus-visible:outline-none"
                  onClick={() => {
                    setQuota(null);
                    router.replace('/admin/users');
                  }}
                >
                  ×
                </button>
              </span>
            )}
          </div>
          {list.error && <NoticeStrip tone="error">{list.error}</NoticeStrip>}
          {list.loading ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            list.ready && <AdminUserTable users={list.users} />
          )}
          {list.hasMore && (
            <Button variant="outline" onClick={list.loadMore} disabled={list.loadingMore}>
              {list.loadingMore ? 'Đang tải…' : 'Xem thêm'}
            </Button>
          )}
        </Section>
      </div>
    </>
  );
}
