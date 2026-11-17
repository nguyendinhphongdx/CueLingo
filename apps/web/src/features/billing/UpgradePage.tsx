'use client';

import type { BillingPeriod, PaidPlan } from '@cuelingo/shared';
import { NoticeStrip } from '@cuelingo/ui/components/notice-strip';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { Skeleton } from '@cuelingo/ui/components/skeleton';
import { Section } from '@cuelingo/ui/components/section';
import { formatDateVn, planName } from '@cuelingo/ui/lib/usage';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { OrderHistory } from './OrderHistory';
import { PlanPicker } from './PlanPicker';
import { useBillingOverview, useCreateOrder, useOrders } from './use-billing';

/** `/upgrade`: pick a plan and period, then go to the QR; below it the person's own payment history. */
export function UpgradePage() {
  const router = useRouter();
  const { overview, loading, error } = useBillingOverview();
  const { orders } = useOrders();
  const { create, error: createError } = useCreateOrder();
  const [busy, setBusy] = useState<string | null>(null);

  const select = async (plan: PaidPlan, period: BillingPeriod) => {
    setBusy(`${plan}:${period}`);
    try {
      const order = await create({ plan, period });
      router.push(`/checkout?order=${order.id}`);
    } catch {
      setBusy(null);
    }
  };

  const current = overview?.current;
  const ends =
    current && current.plan !== 'free' && current.expiresAt
      ? `Gói ${planName(current.plan)} đến ${formatDateVn(current.expiresAt)}`
      : null;

  return (
    <>
      <PageHeader title="Nâng gói" description="Chọn gói và kỳ thanh toán." />
      {loading ? (
        <div className="space-y-3" aria-busy="true">
          <p className="sr-only" aria-live="polite">
            Đang tải…
          </p>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : null}
      {error ? <NoticeStrip tone="error">{error}</NoticeStrip> : null}
      {overview && !overview.enabled ? (
        <NoticeStrip>Tính năng nâng gói chưa mở.</NoticeStrip>
      ) : null}
      {overview?.enabled ? (
        <Section title="Chọn gói" description={ends ?? undefined}>
          <PlanPicker overview={overview} busy={busy} onSelect={(p, k) => void select(p, k)} />
          {createError ? <NoticeStrip tone="error">{createError}</NoticeStrip> : null}
        </Section>
      ) : null}
      {overview?.enabled || orders.length > 0 ? (
        <Section title="Lịch sử thanh toán">
          <OrderHistory orders={orders} />
        </Section>
      ) : null}
    </>
  );
}
