'use client';

import type {
  AdminUserDetail as Detail,
  AdminUserOrder,
  AdminUserRow,
  Plan,
} from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { Card, CardContent } from '@cuelingo/ui/components/card';
import { ConfirmDialog } from '@cuelingo/ui/components/confirm-dialog';
import { Input } from '@cuelingo/ui/components/input';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { ListCard, Section } from '@cuelingo/ui/components/section';
import { Segmented } from '@cuelingo/ui/components/segmented';
import { UsageSummary } from '@cuelingo/ui/components/usage-meter';
import { formatDateVn, formatVnd, planName } from '@cuelingo/ui/lib/usage';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useState } from 'react';
import { useRouteId } from '../../lib/use-route-id';
import { AdminFrame } from './AdminFrame';
import { expiryText, sourceLabel } from './admin-users-format';
import { expiresAtFor, planChangeWarning } from './plan-change';
import { useAdminUser } from './use-admin-user';

const PLANS: { value: Plan; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro' },
  { value: 'ultra', label: 'Ultra' },
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
            <p className="text-muted-foreground text-xs">{STATUS_LABEL[order.status]}</p>
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
  expiresAt,
  now,
  open,
  busy,
  onConfirm,
  onCancel,
}: {
  user: Pick<AdminUserRow, 'email' | 'plan' | 'source' | 'expiresAt'>;
  plan: Plan;
  expiresAt: string | undefined;
  now: Date;
  open: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const warning = planChangeWarning(user, plan, now);
  const until = expiresAt ? `, đến hết ngày ${formatDateVn(expiresAt)}` : ', không hết hạn';
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
      {`${user.email}: ${planName(user.plan)} → ${planName(plan)}${plan === 'free' ? '' : until}. `}
      {warning ? <strong>{warning}</strong> : null}
    </ConfirmDialog>
  );
}

/** Pick a plan and an optional end date, then confirm. Mounted per person, so the fields start from their plan. */
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
  onSave: (input: { plan: Plan; expiresAt?: string }) => void;
  now?: Date;
}) {
  const [plan, setPlan] = useState<Plan>(user.plan);
  const [date, setDate] = useState('');
  const [asking, setAsking] = useState(false);
  const expiresAt = expiresAtFor(plan, date);
  const inPast = expiresAt !== undefined && new Date(expiresAt).getTime() <= now.getTime();

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setAsking(true);
      }}
    >
      <Segmented label="Gói mới" options={PLANS} value={plan} onChange={setPlan} />
      <div className="max-w-xs space-y-1">
        <label htmlFor="plan-expires" className="text-sm font-medium">
          Ngày hết hạn (tuỳ chọn)
        </label>
        <Input
          id="plan-expires"
          type="date"
          value={plan === 'free' ? '' : date}
          disabled={plan === 'free'}
          onChange={(event) => setDate(event.target.value)}
          aria-describedby="plan-expires-hint"
        />
        <p id="plan-expires-hint" className="text-muted-foreground text-xs">
          {plan === 'free'
            ? 'Gói Free không có ngày hết hạn.'
            : 'Hết hạn vào cuối ngày này (giờ Việt Nam). Để trống nếu không hết hạn.'}
        </p>
      </div>
      {inPast && (
        <p role="alert" className="text-destructive text-sm">
          Ngày hết hạn phải ở tương lai.
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" disabled={saving || inPast}>
        Lưu gói
      </Button>
      <PlanChangeConfirm
        user={user}
        plan={plan}
        expiresAt={expiresAt}
        now={now}
        open={asking}
        busy={saving}
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          onSave({ plan, ...(expiresAt ? { expiresAt } : {}) });
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
  saved: boolean;
  onSave: (input: { plan: Plan; expiresAt?: string }) => void;
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
          description="Gói áp dụng từ lần kiểm hạn mức tiếp theo. Ghi là gán tay, kèm tên người đổi."
        >
          <PlanForm user={user} saving={saving} error={saveError} onSave={onSave} />
          {saved && (
            <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
              Đã đổi gói.
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
    <AdminFrame nav={state.detail !== null || state.missing}>
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
    </AdminFrame>
  );
}

/** `/admin/users/<id>`: the id comes from the address bar; the static build has one placeholder page. */
export function AdminUserRoute() {
  const id = useRouteId('/admin/users');
  return id ? <AdminUserDetail id={id} /> : null;
}
