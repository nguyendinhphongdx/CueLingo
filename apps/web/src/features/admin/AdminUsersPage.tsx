'use client';

import type { AdminDashboard, AdminUserRow } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { Card, CardContent } from '@cuelingo/ui/components/card';
import { Input } from '@cuelingo/ui/components/input';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { Section } from '@cuelingo/ui/components/section';
import { Segmented } from '@cuelingo/ui/components/segmented';
import { formatDateVn, formatDurationMs, formatVnd, planName } from '@cuelingo/ui/lib/usage';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useState } from 'react';
import { AdminFrame } from './AdminFrame';
import { expiryText, sourceLabel } from './admin-users-format';
import { useAdminDashboard, useAdminUsers, useDebounced, type PlanFilter } from './use-admin-users';

const number = new Intl.NumberFormat('vi-VN');

const FILTERS: { value: PlanFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro' },
  { value: 'ultra', label: 'Ultra' },
  { value: 'expiring', label: 'Sắp hết hạn' },
];

/** The numbers at the top (AC1). Plans count only while they are in force. */
export function AdminDashboardView({ dashboard }: { dashboard: AdminDashboard }) {
  const stats: [string, string][] = [
    ['Tổng người dùng', number.format(dashboard.totalUsers)],
    ['Free', number.format(dashboard.byPlan.free)],
    ['Pro', number.format(dashboard.byPlan.pro)],
    ['Ultra', number.format(dashboard.byPlan.ultra)],
    ['Đăng ký mới · 7 ngày', number.format(dashboard.newUsers7d)],
    ['Doanh thu tháng này', formatVnd(dashboard.revenueThisMonth)],
    ['Gói trả phí hết hạn · 7 ngày tới', number.format(dashboard.expiringIn7d)],
  ];
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map(([label, value]) => (
        <Card key={label}>
          <CardContent className="pt-5">
            <dt className="text-muted-foreground text-sm leading-5">{label}</dt>
            <dd className="mt-2 text-2xl leading-none font-semibold tracking-tight tabular-nums">
              {value}
            </dd>
          </CardContent>
        </Card>
      ))}
    </dl>
  );
}

/** One row per person (AC2). The email links to the detail page. */
export function AdminUserTable({ users }: { users: AdminUserRow[] }) {
  if (users.length === 0) {
    return <p className="text-muted-foreground text-sm">Không có người dùng nào khớp.</p>;
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
              <th scope="col" className={`${head} text-right`}>
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
                <td className="px-4 py-3 font-medium">{planName(user.plan)}</td>
                <td className="px-4 py-3">{sourceLabel(user.source)}</td>
                <td className="px-4 py-3">{expiryText(user)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatDurationMs(user.translationMsThisMonth)}
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

export function AdminUsersPage() {
  const [text, setText] = useState('');
  const [plan, setPlan] = useState<PlanFilter>('all');
  const q = useDebounced(text);
  const dashboard = useAdminDashboard();
  const list = useAdminUsers({ q, plan });
  if (dashboard.hidden || list.hidden) notFound();

  return (
    // Links show once either call has answered without 401/403: that is proof the caller is an admin.
    <AdminFrame width="wide" nav={dashboard.dashboard !== null || list.ready}>
      <PageHeader
        title="Người dùng và gói"
        description="Ai đang ở gói nào, doanh thu tháng này và gói sắp hết hạn. Chỉ thấy email, gói và lượng dùng, không thấy nội dung cuộc họp."
      />
      <Section title="Tổng quan">
        {dashboard.dashboard ? (
          <AdminDashboardView dashboard={dashboard.dashboard} />
        ) : dashboard.error ? (
          <p role="alert" className="text-destructive text-sm">
            {dashboard.error}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm" aria-live="polite">
            Đang tải số liệu…
          </p>
        )}
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
            <Segmented label="Lọc theo gói" options={FILTERS} value={plan} onChange={setPlan} />
          </div>
          {list.error && (
            <p role="alert" className="text-destructive text-sm">
              {list.error}
            </p>
          )}
          {list.loading ? (
            <p className="text-muted-foreground text-sm" aria-live="polite">
              Đang tải…
            </p>
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
    </AdminFrame>
  );
}
