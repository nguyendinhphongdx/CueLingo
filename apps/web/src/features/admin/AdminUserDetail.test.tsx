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
import { expiresAtFor, planChangeWarning } from './plan-change';

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
        saved={false}
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
          expiresAt={undefined}
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
          expiresAt={undefined}
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
  it('starts from the current plan and offers the three plans and an end date', () => {
    const markup = renderToStaticMarkup(
      <PlanForm user={paidPro} saving={false} error={null} onSave={() => {}} now={NOW} />,
    );
    for (const plan of ['Free', 'Pro', 'Ultra']) expect(markup).toContain(plan);
    expect(markup).toMatch(/aria-pressed="true"[^>]*>Pro</);
    expect(markup).toContain('type="date"');
    expect(markup).toContain('Lưu gói');
  });

  it('shows the error the server gave, and no end date field for Free', () => {
    const free = renderToStaticMarkup(
      <PlanForm user={{ ...paidPro, plan: 'free' }} saving={false} error="Lỗi" onSave={() => {}} />,
    );
    expect(free).toContain('Lỗi');
    expect(free).toMatch(/<input[^>]*disabled/);
    expect(free).toContain('Gói Free không có ngày hết hạn');
  });

  it('turns the chosen day into the end of that day in Vietnam, and drops it for Free', () => {
    expect(expiresAtFor('pro', '2026-12-31')).toBe('2026-12-31T16:59:59.999Z');
    expect(expiresAtFor('ultra', '')).toBeUndefined();
    expect(expiresAtFor('free', '2026-12-31')).toBeUndefined();
    expect(expiresAtFor('pro', 'not a date')).toBeUndefined();
  });
});
