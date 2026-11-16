'use client';

import type { BillingPeriod, PaidPlan } from '@cuelingo/shared';
import { PageHeader } from '@cuelingo/ui/components/page-header';
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
      {loading ? <p className="text-muted-foreground text-sm">Đang tải…</p> : null}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {overview && !overview.enabled ? (
        <p className="text-muted-foreground text-sm">Tính năng nâng gói chưa mở.</p>
      ) : null}
      {overview?.enabled ? (
        <Section title="Chọn gói" description={ends ?? undefined}>
          <PlanPicker overview={overview} busy={busy} onSelect={(p, k) => void select(p, k)} />
          {createError ? (
            <p role="alert" className="text-destructive text-sm">
              {createError}
            </p>
          ) : null}
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
