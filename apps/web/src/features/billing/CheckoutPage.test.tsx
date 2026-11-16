// @vitest-environment jsdom
import type { BillingOrder } from '@cuelingo/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { order } from './fixtures';

const getOrder = vi.fn<(id: string) => Promise<BillingOrder>>();
vi.mock('../../lib/client', () => ({
  client: { billing: { getOrder: (id: string) => getOrder(id), createOrder: vi.fn() } },
}));

const { CheckoutView, formatCountdown } = await import('./CheckoutPage');
const { ORDER_POLL_MS, orderRefetchInterval, useOrder } = await import('./use-billing');

const NOW = new Date('2026-11-15T10:05:00.000Z').getTime();
const view = (props: Partial<Parameters<typeof CheckoutView>[0]> = {}) =>
  renderToStaticMarkup(
    <CheckoutView
      order={order()}
      loading={false}
      error={null}
      cancelled={false}
      now={NOW}
      retrying={false}
      onRetry={() => {}}
      {...props}
    />,
  );

describe('CheckoutView', () => {
  it('shows the QR, amount, transfer content, countdown and the MoMo line (AC12)', () => {
    const markup = view();
    expect(markup).toContain('<svg');
    expect(markup).toContain('99.000 ₫');
    expect(markup).toContain('CL123456');
    expect(markup).toContain('10:00');
    expect(markup).toContain('Quét bằng app ngân hàng hoặc MoMo');
    expect(markup).toContain('Mở trang thanh toán PayOS');
    expect(markup).toContain('rel="noopener noreferrer"');
  });

  it('offers no link that is not https', () => {
    expect(view({ order: order({ checkoutUrl: 'javascript:alert(1)' }) })).not.toContain(
      'Mở trang thanh toán PayOS',
    );
  });

  it('does not claim an upgrade when the money came but the plan did not change', () => {
    const markup = view({
      order: order({ status: 'paid', paidAt: '2026-11-15T10:02:00.000Z', planApplied: false }),
    });
    expect(markup).not.toContain('Đã lên gói');
    expect(markup).toContain('Đã nhận tiền nhưng gói không đổi vì bạn đã có gói cao hơn');
    expect(markup).toContain('Chúng tôi sẽ liên hệ hoàn tiền');
  });

  it('says which plan is active until when once paid (AC5)', () => {
    const markup = view({
      order: order({
        status: 'paid',
        paidAt: '2026-11-15T10:02:00.000Z',
        planExpiresAt: '2026-12-15T10:02:00.000Z',
        planApplied: true,
      }),
    });
    expect(markup).toContain('Đã lên gói Pro đến 15/12/2026');
    expect(markup).toContain('href="/settings"');
    expect(markup).not.toContain('<svg');
  });

  it('offers a new order when the old one expired (AC6), also when the clock passed its end', () => {
    expect(view({ order: order({ status: 'expired', qrCode: null }) })).toContain('Tạo đơn mới');
    expect(view({ order: order({ status: 'expired', qrCode: null }) })).toContain(
      'gói sẽ tự lên khi hệ thống nhận được tiền',
    );
    expect(view({ now: new Date('2026-11-15T10:16:00.000Z').getTime() })).toContain('Tạo đơn mới');
  });

  it('tells the payer when they cancelled', () => {
    expect(view({ order: order({ status: 'cancelled', qrCode: null }) })).toContain('đã huỷ');
    const stillOpen = view({ cancelled: true });
    expect(stillOpen).toContain('đóng trang PayOS');
    expect(stillOpen).toContain('<svg');
  });

  it('shows loading and a missing order', () => {
    expect(view({ order: undefined, loading: true })).toContain('Đang tải đơn');
    expect(view({ order: undefined, error: 'Lỗi' })).toContain('Lỗi');
  });

  it('formats the countdown', () => {
    expect(formatCountdown(15 * 60_000)).toBe('15:00');
    expect(formatCountdown(61_500)).toBe('01:02');
    expect(formatCountdown(-5)).toBe('00:00');
  });
});

describe('orderRefetchInterval', () => {
  it('polls only while pending', () => {
    expect(orderRefetchInterval(order())).toBe(ORDER_POLL_MS);
    for (const status of ['paid', 'cancelled'] as const) {
      expect(orderRefetchInterval(order({ status }))).toBe(false);
    }
    expect(orderRefetchInterval(undefined)).toBe(false);
  });

  it('polls an expired order every 15 s for 10 minutes, then stops (G3)', () => {
    const expired = order({ status: 'expired', qrCode: null });
    const end = new Date(expired.expiresAt).getTime();
    expect(orderRefetchInterval(expired, end + 60_000)).toBe(15_000);
    expect(orderRefetchInterval(expired, end + 10 * 60_000)).toBe(false);
  });
});

describe('useOrder polling (AC5)', () => {
  let root: Root;
  let host: HTMLElement;
  let seen: BillingOrder | undefined;

  function Probe({ id }: { id: string }): ReactNode {
    seen = useOrder(id).order;
    return null;
  }

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    getOrder.mockReset();
    seen = undefined;
    host = document.createElement('div');
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  it('asks every 3 s while pending and stops once the order is paid', async () => {
    getOrder.mockResolvedValue(order());
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Probe id="11111111-1111-4111-8111-111111111111" />
        </QueryClientProvider>,
      );
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(getOrder).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ORDER_POLL_MS);
    });
    expect(getOrder).toHaveBeenCalledTimes(2);

    getOrder.mockResolvedValue(
      order({ status: 'paid', planExpiresAt: '2026-12-15T10:02:00.000Z', planApplied: true }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ORDER_POLL_MS);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(seen?.status).toBe('paid');
    const calls = getOrder.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ORDER_POLL_MS * 5);
    });
    expect(getOrder).toHaveBeenCalledTimes(calls);
  });
});
