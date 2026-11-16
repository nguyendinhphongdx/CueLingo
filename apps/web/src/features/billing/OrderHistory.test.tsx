import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { order } from './fixtures';
import { OrderHistory } from './OrderHistory';

describe('OrderHistory', () => {
  it('shows an empty state', () => {
    expect(renderToStaticMarkup(<OrderHistory orders={[]} />)).toContain('Chưa có giao dịch');
  });

  it('lists plan, period, amount, status and date of each order (AC9)', () => {
    const markup = renderToStaticMarkup(
      <OrderHistory
        orders={[
          order({ id: 'a', status: 'paid', plan: 'ultra', period: 'year', amount: 2_490_000 }),
          order({ id: 'b', status: 'expired' }),
          order({ id: 'c', status: 'cancelled' }),
          order({ id: 'd', status: 'pending' }),
        ]}
      />,
    );
    expect(markup).toContain('Gói Ultra · 1 năm');
    expect(markup).toContain('2.490.000 ₫');
    expect(markup).toContain('Đã thanh toán');
    expect(markup).toContain('Hết hạn');
    expect(markup).toContain('Đã huỷ');
    expect(markup).toContain('15/11/2026');
  });

  it('links only a pending order back to its QR', () => {
    const markup = renderToStaticMarkup(
      <OrderHistory
        orders={[order({ id: 'p1', status: 'pending' }), order({ id: 'x', status: 'paid' })]}
      />,
    );
    expect(markup).toContain('href="/checkout?order=p1"');
    expect(markup).not.toContain('order=x');
  });

  it('labels an order an admin granted as "Admin tặng" with 0đ', () => {
    const markup = renderToStaticMarkup(
      <OrderHistory orders={[order({ status: 'paid', amount: 0, byAdmin: true })]} />,
    );
    expect(markup).toContain('Admin tặng');
    expect(markup).toContain('0 ₫');
    expect(markup).not.toContain('Đã thanh toán');
  });
});
