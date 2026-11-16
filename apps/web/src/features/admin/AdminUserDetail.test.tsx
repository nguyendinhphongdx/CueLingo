import type { AdminUserDetail, AdminUserRow } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/users/x', notFound: vi.fn() }));

import {
  AdminOrderList,
  AdminUserDetailView,
  PlanChangeConfirm,
  PlanForm,
} from './AdminUserDetail';
import { planChangeWarning, previewExpiresAt } from './plan-change';

const NOW = new Date('2026-11-15T05:00:00Z');
const paidPro: AdminUserRow = {
  id: '0b9f2f5e-7c52-4d57-9d4c-1f5f3a7a9a10',
  email: 'lan@example.com',
  name: 'Lan Anh',
  createdAt: '2026-11-01T03:00:00.000Z',
  plan: 'pro',
  source: 'payment',
  expiresAt: '2026-12-05T10:00:00.000Z',
  translationMsThisMonth: 0,
  lastActiveAt: null,
};
const item = (used: number, limit: number | null) => ({
  used,
  limit,
  resetsAt: '2026-12-01T00:00:00.000Z',
  state: 'ok' as const,
});
const detail: AdminUserDetail = {
  user: paidPro,
  usage: {
    plan: 'pro',
    usage: {
      translation_ms: item(3_600_000, 72_000_000),
      cloud_stt_ms: item(0, 36_000_000),
      debriefs: item(2, null),
      assist_daily: item(0, null),
      agent_messages: item(5, 100),
    },
  },
  orders: [
    {
      id: '1b9f2f5e-7c52-4d57-9d4c-1f5f3a7a9a10',
      plan: 'pro',
      period: 'month',
      amount: 99000,
      status: 'paid',
      byAdmin: false,
      createdAt: '2026-11-05T03:00:00.000Z',
      paidAt: '2026-11-05T03:05:00.000Z',
      planExpiresAt: '2026-12-05T10:00:00.000Z',
    },
  ],
};

describe('AdminUserDetailView (AC4)', () => {
  it('shows plan, the five allowances and the orders, and nothing about meetings', () => {
    const markup = renderToStaticMarkup(
      <AdminUserDetailView
        detail={detail}
        saving={false}
        saveError={null}
        saved={null}
        onSave={() => {}}
      />,
    );
    expect(markup).toContain('lan@example.com');
    expect(markup).toContain('Nguồn: Thanh toán');
    expect(markup).toContain('05/12/2026');
    for (const label of [
      'Giờ dịch',
      'Nhận dạng giọng nói đám mây',
      'Debrief sau họp',
      'Tin nhắn trợ lý',
    ]) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain('99.000 ₫');
    expect(markup).toContain('Đã thanh toán');
    expect(markup).not.toMatch(/transcript|qr|checkout/i);
  });

  it('says so when there are no orders', () => {
    expect(renderToStaticMarkup(<AdminOrderList orders={[]} />)).toContain('Chưa có giao dịch');
  });
});

describe('warning before lowering a paid plan (AC6)', () => {
  it('warns with the date when a plan paid for and still in force is lowered', () => {
    const text = planChangeWarning(paidPro, 'free', NOW);
    expect(text).toContain('Người này đã trả tiền đến 05/12/2026');
    expect(planChangeWarning({ ...paidPro, plan: 'ultra' }, 'pro', NOW)).toContain('05/12/2026');
  });

  it('does not warn on an upgrade, the same plan, a hand-set plan, or one that already ended', () => {
    expect(planChangeWarning(paidPro, 'ultra', NOW)).toBeNull();
    expect(planChangeWarning(paidPro, 'pro', NOW)).toBeNull();
    expect(planChangeWarning({ ...paidPro, source: 'manual' }, 'free', NOW)).toBeNull();
    expect(
      planChangeWarning({ ...paidPro, expiresAt: '2026-11-01T00:00:00.000Z' }, 'free', NOW),
    ).toBeNull();
    expect(
      planChangeWarning({ ...paidPro, plan: 'free', source: null, expiresAt: null }, 'pro', NOW),
    ).toBeNull();
  });

  it('shows the warning inside the confirmation, only when it applies', () => {
    const ask = (user: AdminUserRow, plan: 'free' | 'pro' | 'ultra') =>
      renderToStaticMarkup(
        <PlanChangeConfirm
          user={user}
          plan={plan}
          period="month"
          expiresAt={null}
          now={NOW}
          open
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );
    const down = ask(paidPro, 'free');
    expect(down).toContain('Đổi gói?');
    expect(down).toContain('Người này đã trả tiền đến 05/12/2026');
    expect(down).toContain('lan@example.com: Pro → Free');
    expect(ask(paidPro, 'ultra')).not.toContain('đã trả tiền');
    expect(ask({ ...paidPro, source: 'manual' }, 'free')).not.toContain('đã trả tiền');
  });

  it('asks nothing while closed', () => {
    expect(
      renderToStaticMarkup(
        <PlanChangeConfirm
          user={paidPro}
          plan="free"
          period="month"
          expiresAt={null}
          now={NOW}
          open={false}
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      ),
    ).toBe('');
  });
});

describe('plan form (AC5)', () => {
  const form = (user: AdminUserRow, error: string | null = null) =>
    renderToStaticMarkup(
      <PlanForm user={user} saving={false} error={error} onSave={() => {}} now={NOW} />,
    );

  it('starts from the current plan, with a period and the expected end date, and no date input', () => {
    const markup = form(paidPro);
    for (const label of ['Free', 'Pro', 'Ultra', '1 tháng', '1 năm']) {
      expect(markup).toContain(label);
    }
    expect(markup).toMatch(/aria-pressed="true"[^>]*>Pro</);
    expect(markup).toMatch(/aria-pressed="true"[^>]*>1 tháng</);
    // Pro paid until 05/12/2026: one more month extends from that date.
    expect(markup).toContain('Hết hạn (dự kiến): 05/01/2027');
    expect(markup).not.toContain('type="date"');
    expect(markup).toContain('Lưu gói');
  });

  it('shows the server error, and no period or end date for Free', () => {
    const free = form({ ...paidPro, plan: 'free', source: null, expiresAt: null }, 'Lỗi');
    expect(free).toContain('Lỗi');
    expect(free).not.toContain('1 năm');
    expect(free).not.toContain('dự kiến');
  });

  it('works out the date like a grant: extend, fresh start, downgrade, convert', () => {
    const iso = (
      user: Parameters<typeof previewExpiresAt>[0],
      plan: 'free' | 'pro' | 'ultra',
      period: 'month' | 'year' = 'month',
    ) => previewExpiresAt(user, plan, period, NOW);
    expect(iso(paidPro, 'pro')).toBe('2027-01-05T10:00:00.000Z');
    expect(iso(paidPro, 'pro', 'year')).toBe('2027-12-05T10:00:00.000Z');
    expect(iso({ plan: 'free', source: null, expiresAt: null }, 'pro')).toBe(
      '2026-12-15T05:00:00.000Z',
    );
    expect(iso({ ...paidPro, plan: 'ultra' }, 'pro')).toBe('2026-12-15T05:00:00.000Z');
    expect(iso({ ...paidPro, source: 'manual', expiresAt: null }, 'pro')).toBe(
      '2026-12-15T05:00:00.000Z',
    );
    expect(iso(paidPro, 'ultra')! > '2026-12-15T05:00:00.000Z').toBe(true);
    expect(iso(paidPro, 'free')).toBeNull();
  });

  it('puts the date, the period and the 0 dong order into the confirmation', () => {
    const text = renderToStaticMarkup(
      <PlanChangeConfirm
        user={paidPro}
        plan="ultra"
        period="year"
        expiresAt="2027-12-05T10:00:00.000Z"
        now={NOW}
        open
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(text).toContain('Pro → Ultra, 1 năm, hết hạn 05/12/2027 (dự kiến)');
    expect(text).toContain('đơn 0đ');
  });

  it('labels an order granted by an admin and shows its 0 dong', () => {
    const markup = renderToStaticMarkup(
      <AdminOrderList orders={[{ ...detail.orders[0]!, amount: 0, byAdmin: true }]} />,
    );
    expect(markup).toContain('Admin tặng');
    expect(markup).toContain('0');
    expect(markup).not.toContain('Đã thanh toán');
  });
});
