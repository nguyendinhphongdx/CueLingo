'use client';

import type {
  AdminUserDetail as Detail,
  AdminSetUserPlanRequest,
  AdminUserOrder,
  AdminUserRow,
  BillingPeriod,
  Plan,
} from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { Card, CardContent } from '@cuelingo/ui/components/card';
import { ConfirmDialog } from '@cuelingo/ui/components/confirm-dialog';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { ListCard, Section } from '@cuelingo/ui/components/section';
import { Segmented } from '@cuelingo/ui/components/segmented';
import { UsageSummary } from '@cuelingo/ui/components/usage-meter';
import { formatDateVn, formatVnd, planName } from '@cuelingo/ui/lib/usage';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useState } from 'react';
import { useRouteId } from '../../lib/use-route-id';
import { expiryText, sourceLabel } from './admin-users-format';
import { planChangeWarning, previewExpiresAt } from './plan-change';
import { useAdminUser } from './use-admin-user';

const PLANS: { value: Plan; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro' },
  { value: 'ultra', label: 'Ultra' },
];

const PERIODS: { value: BillingPeriod; label: string }[] = [
  { value: 'month', label: '1 tháng' },
  { value: 'year', label: '1 năm' },
];

const STATUS_LABEL: Record<AdminUserOrder['status'], string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  expired: 'Hết hạn',
  cancelled: 'Đã huỷ',
};

/** Payment history (AC4): plan, period, amount, status and date. No QR, no payment link. */
export function AdminOrderList({ orders }: { orders: AdminUserOrder[] }) {
  if (orders.length === 0) {
    return <p className="text-muted-foreground text-sm">Chưa có giao dịch nào.</p>;
  }
  return (
    <ListCard>
      {orders.map((order) => (
        <li
          key={order.id}
          className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
        >
          <div>
            <p className="font-medium">
              Gói {planName(order.plan)} · {order.period === 'year' ? '1 năm' : '1 tháng'}
            </p>
            <p className="text-muted-foreground text-xs">{formatDateVn(order.createdAt)}</p>
          </div>
          <div className="text-right">
            <p>{formatVnd(order.amount)}</p>
            <p className="text-muted-foreground text-xs">
              {order.byAdmin ? 'Admin tặng' : STATUS_LABEL[order.status]}
            </p>
          </div>
        </li>
      ))}
    </ListCard>
  );
}

/** The question asked before the plan is saved (AC5), with the warning of AC6 when a paid plan is lowered. */
export function PlanChangeConfirm({
  user,
  plan,
  period,
  expiresAt,
  now,
  open,
  busy,
  onConfirm,
  onCancel,
}: {
  user: Pick<AdminUserRow, 'email' | 'plan' | 'source' | 'expiresAt'>;
  plan: Plan;
  period: BillingPeriod;
  /** The planned end date (see `previewExpiresAt`); null for Free. */
  expiresAt: string | null;
  now: Date;
  open: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const warning = planChangeWarning(user, plan, now);
  const detail =
    plan === 'free'
      ? ', không hết hạn'
      : `, ${period === 'year' ? '1 năm' : '1 tháng'}, hết hạn ${expiresAt ? formatDateVn(expiresAt) : ''} (dự kiến). Hệ thống ghi một đơn 0đ "Admin tặng"`;
  return (
    <ConfirmDialog
      open={open}
      title="Đổi gói?"
      confirmLabel={busy ? 'Đang lưu…' : 'Đổi gói'}
      cancelLabel="Huỷ"
      // A stray Enter should refuse, not agree: money may be involved.
      initialFocus="cancel"
      onConfirm={busy ? () => {} : onConfirm}
      onCancel={onCancel}
    >
      {`${user.email}: ${planName(user.plan)} → ${planName(plan)}${detail}. `}
      {warning ? <strong>{warning}</strong> : null}
    </ConfirmDialog>
  );
}

/**
 * Pick a plan and, for Pro or Ultra, a period (default 1 month), then confirm. The end date is the server's
 * work; the form shows the date it expects. Mounted per person, so the plan field starts from their plan.
 */
export function PlanForm({
  user,
  saving,
  error,
  onSave,
  now = new Date(),
}: {
  user: AdminUserRow;
  saving: boolean;
  error: string | null;
  onSave: (input: AdminSetUserPlanRequest) => void;
  now?: Date;
}) {
  const [plan, setPlan] = useState<Plan>(user.plan);
  const [period, setPeriod] = useState<BillingPeriod>('month');
  const [asking, setAsking] = useState(false);
  const expiresAt = previewExpiresAt(user, plan, period, now);

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setAsking(true);
      }}
    >
      <Segmented label="Gói mới" options={PLANS} value={plan} onChange={setPlan} />
      {plan !== 'free' && (
        <>
          <Segmented label="Thời hạn" options={PERIODS} value={period} onChange={setPeriod} />
          <p className="text-muted-foreground text-sm">
            Hết hạn (dự kiến): {expiresAt ? formatDateVn(expiresAt) : '—'}. Tính như khi mua: gia
            hạn từ ngày hết hạn hiện tại nếu cùng gói, hạ gói thì bắt đầu từ hôm nay.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" disabled={saving}>
        Lưu gói
      </Button>
      <PlanChangeConfirm
        user={user}
        plan={plan}
        period={period}
        expiresAt={expiresAt}
        now={now}
        open={asking}
        busy={saving}
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          onSave(plan === 'free' ? { plan } : { plan, period });
          setAsking(false);
        }}
      />
    </form>
  );
}

/** Everything about one person (AC4): plan, usage this month, orders. Never meeting content. */
export function AdminUserDetailView({
  detail,
  saving,
  saveError,
  saved,
  onSave,
}: {
  detail: Detail;
  saving: boolean;
  saveError: string | null;
  /** The end date the server worked out for the last save: `null` = no end date, undefined = not saved yet. */
  saved: { expiresAt: string | null } | null;
  onSave: (input: AdminSetUserPlanRequest) => void;
}) {
  const { user } = detail;
  return (
    <>
      <PageHeader
        title={user.email}
        description={`${user.name} · đăng ký ${formatDateVn(user.createdAt)}`}
      />
      <Section title="Gói và lượng dùng tháng này">
        <Card>
          <CardContent className="space-y-3 pt-5">
            <p className="text-muted-foreground text-sm">
              Nguồn: {sourceLabel(user.source)} · Hết hạn: {expiryText(user)}
            </p>
            <UsageSummary
              plan={detail.usage.plan}
              planExpiresAt={user.plan === 'free' ? null : user.expiresAt}
              usage={detail.usage.usage}
            />
          </CardContent>
        </Card>
      </Section>
      <div className="mt-8">
        <Section
          title="Đổi gói"
          description="Giống một lần mua nhưng không qua thanh toán: gói áp dụng từ lần kiểm hạn mức tiếp theo, ghi là gán tay kèm tên người đổi và một đơn 0đ (Admin tặng) cho gói trả phí."
        >
          <PlanForm user={user} saving={saving} error={saveError} onSave={onSave} />
          {saved && (
            <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
              Đã đổi gói.{saved.expiresAt ? ` Hết hạn ${formatDateVn(saved.expiresAt)}.` : ''}
            </p>
          )}
        </Section>
      </div>
      <div className="mt-8">
        <Section title="Lịch sử thanh toán">
          <AdminOrderList orders={detail.orders} />
        </Section>
      </div>
    </>
  );
}

export function AdminUserDetail({ id }: { id: string }) {
  const state = useAdminUser(id);
  if (state.hidden) notFound();
  const back = (
    <p className="mb-4 text-sm">
      <Link href="/admin/users" className="underline-offset-2 hover:underline">
        ← Danh sách người dùng
      </Link>
    </p>
  );
  return (
    <>
      {back}
      {state.loading && (
        <p className="text-muted-foreground text-sm" aria-live="polite">
          Đang tải…
        </p>
      )}
      {state.missing && <p role="alert">Không tìm thấy người dùng này.</p>}
      {state.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
      {state.detail && (
        <AdminUserDetailView
          key={state.detail.user.id}
          detail={state.detail}
          saving={state.saving}
          saveError={state.saveError}
          saved={state.saved}
          onSave={state.save}
        />
      )}
    </>
  );
}

/** `/admin/users/<id>`: the id comes from the address bar; the static build has one placeholder page. */
export function AdminUserRoute() {
  const id = useRouteId('/admin/users');
  return id ? <AdminUserDetail id={id} /> : null;
}
