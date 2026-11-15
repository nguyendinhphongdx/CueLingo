'use client';

import type { BillingOrder } from '@cuelingo/shared';
import { Button, buttonVariants } from '@cuelingo/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@cuelingo/ui/components/card';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { formatDateVn, formatVnd, planName } from '@cuelingo/ui/lib/usage';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { QrCode } from './QrCode';
import { useCreateOrder, useOrder } from './use-billing';

/** "14:05": minutes and seconds left, never negative. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Only a PayOS page over https is offered as a link. */
function safeHttps(url: string | null): string | null {
  return url !== null && url.startsWith('https://') ? url : null;
}

export interface CheckoutViewProps {
  order?: BillingOrder;
  loading: boolean;
  error: string | null;
  /** The payer came back from PayOS with `cancelled=1`. */
  cancelled: boolean;
  /** Current time in ms, for the countdown. */
  now: number;
  retrying: boolean;
  onRetry: () => void;
}

function Notice({ children, tone = 'muted' }: { children: string; tone?: 'muted' | 'error' }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={tone === 'error' ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'}
    >
      {children}
    </p>
  );
}

function Pending({ order, now }: { order: BillingOrder; now: number }) {
  const left = new Date(order.expiresAt).getTime() - now;
  const checkoutUrl = safeHttps(order.checkoutUrl);
  return (
    <div className="space-y-4">
      {order.qrCode ? (
        <div className="flex justify-center">
          <QrCode value={order.qrCode} label="Mã QR chuyển khoản" />
        </div>
      ) : null}
      <p className="text-center text-sm">Quét bằng app ngân hàng hoặc MoMo</p>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Số tiền</dt>
          <dd className="font-semibold">{formatVnd(order.amount)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Nội dung chuyển khoản</dt>
          <dd className="font-mono font-semibold">{order.transferContent}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Còn lại</dt>
          <dd className="font-semibold tabular-nums">{formatCountdown(left)}</dd>
        </div>
      </dl>
      <p role="status" className="text-muted-foreground text-xs">
        Đang chờ thanh toán. Trang tự cập nhật khi tiền về, không cần tải lại.
      </p>
      {checkoutUrl ? (
        <p className="text-sm">
          <a className="underline" href={checkoutUrl} target="_blank" rel="noopener noreferrer">
            Mở trang thanh toán PayOS
          </a>
        </p>
      ) : null}
    </div>
  );
}

/** Pure presentation of the payment screen (AC5, AC6, AC12): no data fetching, easy to test. */
export function CheckoutView({
  order,
  loading,
  error,
  cancelled,
  now,
  retrying,
  onRetry,
}: CheckoutViewProps) {
  const retry = (
    <Button className="min-h-11" disabled={retrying} onClick={onRetry}>
      {retrying ? 'Đang tạo…' : 'Tạo đơn mới'}
    </Button>
  );
  const expired =
    order?.status === 'expired' ||
    (order?.status === 'pending' && new Date(order.expiresAt).getTime() <= now);

  let body;
  if (loading) body = <Notice>Đang tải đơn…</Notice>;
  else if (!order) {
    body = (
      <div className="space-y-3">
        <Notice tone="error">{error ?? 'Không tìm thấy đơn thanh toán.'}</Notice>
        <Link href="/upgrade" className={buttonVariants({ variant: 'outline' })}>
          Chọn gói
        </Link>
      </div>
    );
  } else if (order.status === 'paid') {
    body = (
      <div className="space-y-3">
        <p role="status" className="text-sm font-medium">
          Đã lên gói {planName(order.plan)}
          {order.planExpiresAt ? ` đến ${formatDateVn(order.planExpiresAt)}` : ''}
        </p>
        <Link href="/settings" className={buttonVariants()}>
          Về Cài đặt
        </Link>
      </div>
    );
  } else if (order.status === 'cancelled' || (cancelled && expired)) {
    body = (
      <div className="space-y-3">
        <Notice>Bạn đã huỷ thanh toán. Chưa có khoản nào bị trừ.</Notice>
        {retry}
      </div>
    );
  } else if (expired) {
    body = (
      <div className="space-y-3">
        <Notice>Đơn đã hết hạn thanh toán. Hãy tạo đơn mới.</Notice>
        {retry}
      </div>
    );
  } else {
    body = (
      <div className="space-y-3">
        {cancelled ? (
          <Notice>Bạn đã đóng trang PayOS. Đơn vẫn còn hạn, bạn có thể quét mã dưới đây.</Notice>
        ) : null}
        <Pending order={order} now={now} />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Thanh toán"
        description={
          order
            ? `Gói ${planName(order.plan)} · ${order.period === 'year' ? '1 năm' : '1 tháng'}`
            : undefined
        }
      />
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Chuyển khoản VietQR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && order ? <Notice tone="error">{error}</Notice> : null}
          {body}
        </CardContent>
      </Card>
    </>
  );
}

/** Ticks once a second while `active`, for the countdown. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/** `/checkout?order=<id>[&cancelled=1]`: the QR, the countdown and the live status. Static export: no dynamic route. */
export function CheckoutPage() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get('order');
  const cancelled = params.get('cancelled') === '1';
  const { order, loading, error } = useOrder(orderId);
  const { create, creating, error: createError } = useCreateOrder();
  const now = useNow(order?.status === 'pending');

  const retry = async () => {
    if (!order) return;
    try {
      const next = await create({ plan: order.plan, period: order.period });
      router.replace(`/checkout?order=${next.id}`);
    } catch {
      // The hook exposes the message as `error`.
    }
  };

  return (
    <CheckoutView
      order={order}
      loading={loading}
      error={createError ?? error}
      cancelled={cancelled}
      now={now}
      retrying={creating}
      onRetry={() => void retry()}
    />
  );
}
