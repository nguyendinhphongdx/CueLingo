// @vitest-environment jsdom
import type { AdminDashboard, AdminUserRow } from '@cuelingo/shared';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/users', notFound: vi.fn() }));

import { AdminDashboardView, AdminUserTable, rowUsage } from './AdminUsersPage';
import { expiryText, sourceLabel } from './admin-users-format';
import { queryFor } from './use-admin-users';

const dashboard: AdminDashboard = {
  generatedAt: '2026-11-15T05:00:00.000Z',
  totalUsers: 1234,
  byPlan: { free: 1100, pro: 100, ultra: 34 },
  newUsers7d: 21,
  revenueThisMonth: 12_345_000,
  expiringIn7d: 6,
};

const row = (extra: Partial<AdminUserRow> = {}): AdminUserRow => ({
  id: '0b9f2f5e-7c52-4d57-9d4c-1f5f3a7a9a10',
  email: 'lan@example.com',
  name: 'Lan Anh',
  createdAt: '2026-11-01T03:00:00.000Z',
  plan: 'pro',
  source: 'payment',
  expiresAt: '2026-12-05T10:00:00.000Z',
  translationMsThisMonth: 5_400_000,
  lastActiveAt: '2026-11-14T09:00:00.000Z',
  ...extra,
});

describe('AdminDashboardView (AC1)', () => {
  it('shows every number, with money in dong', () => {
    const markup = renderToStaticMarkup(<AdminDashboardView dashboard={dashboard} />);
    for (const text of [
      'Tổng người dùng',
      '1.234',
      'Free',
      '1.100',
      'Pro',
      'Ultra',
      'Đăng ký mới · 7 ngày',
      'Doanh thu tháng này',
      '12.345.000 ₫',
      'Gói trả phí hết hạn · 7 ngày tới',
    ]) {
      expect(markup).toContain(text);
    }
  });
});

describe('AdminUserTable (AC2)', () => {
  it('shows email, name, signup, plan, source, end date, translation hours and last activity', () => {
    const markup = renderToStaticMarkup(<AdminUserTable users={[row()]} />);
    expect(markup).toContain('href="/admin/users/0b9f2f5e-7c52-4d57-9d4c-1f5f3a7a9a10"');
    expect(markup).toContain('lan@example.com');
    expect(markup).toContain('Lan Anh');
    expect(markup).toContain('01/11/2026');
    expect(markup).toContain('>Pro<');
    expect(markup).toContain('Thanh toán');
    expect(markup).toContain('05/12/2026');
    expect(markup).toContain('Đã dùng 1 giờ 30 phút');
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('14/11/2026');
    expect(markup).toContain('scope="row"');
  });

  it('says what an empty list or a missing value means', () => {
    expect(renderToStaticMarkup(<AdminUserTable users={[]} />)).toContain('Không có người dùng');
    const never = renderToStaticMarkup(
      <AdminUserTable
        users={[row({ plan: 'free', source: null, expiresAt: null, lastActiveAt: null })]}
      />,
    );
    expect(never).toContain('Chưa có');
  });

  it('shows an ended plan as Free with its old end date (G3)', () => {
    const ended = row({ plan: 'free', expiresAt: '2026-11-10T10:00:00.000Z' });
    expect(expiryText(ended)).toBe('Hết hạn 10/11/2026');
    expect(expiryText(row({ expiresAt: null }))).toBe('Không hết hạn');
    expect(expiryText(row({ plan: 'free', expiresAt: null }))).toBe('—');
    expect(sourceLabel('manual')).toBe('Gán tay');
    expect(sourceLabel(null)).toBe('—');
  });
});

describe('queryFor (AC3)', () => {
  it('sends only what is set', () => {
    expect(queryFor({ q: '  ', plan: 'all' })).toEqual({});
    expect(queryFor({ q: ' an ', plan: 'pro' })).toEqual({ q: 'an', plan: 'pro' });
    expect(queryFor({ q: '', plan: 'free' })).toEqual({ plan: 'free' });
    expect(queryFor({ q: '', plan: 'expiring' })).toEqual({ expiring: '1' });
  });
});

describe('stat cards as filters (AC15)', () => {
  const pressed = (markup: string) =>
    [...markup.matchAll(/<button[^>]*aria-pressed="true"[^>]*>([\s\S]*?)<\/button>/g)].map(
      (m) => m[1],
    );

  it('marks the card of the filter in force and no other', () => {
    const view = (selected: 'all' | 'pro' | 'expiring') =>
      renderToStaticMarkup(
        <AdminDashboardView dashboard={dashboard} selected={selected} onSelect={() => {}} />,
      );
    const pro = pressed(view('pro'));
    expect(pro).toHaveLength(1);
    expect(pro[0]).toContain('>Pro<');
    expect(pressed(view('expiring'))[0]).toContain('Gói trả phí hết hạn');
    expect(pressed(view('all'))[0]).toContain('Tổng người dùng');
  });

  it('makes only the people-group cards pressable; revenue and new signups stay plain numbers', () => {
    const markup = renderToStaticMarkup(
      <AdminDashboardView dashboard={dashboard} selected="all" onSelect={() => {}} />,
    );
    expect(markup.match(/<button/g)).toHaveLength(5);
    expect(markup).toContain('Doanh thu tháng này');
  });

  it('shows plain cards when nothing listens', () => {
    expect(renderToStaticMarkup(<AdminDashboardView dashboard={dashboard} />)).not.toContain(
      '<button',
    );
  });
});

describe('stat cards as filters, interaction (AC15)', () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  function mount(value: AdminDashboard | null, onSelect: (filter: string) => void) {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(<AdminDashboardView dashboard={value} onSelect={onSelect} />));
    const cleanup = () => {
      act(() => root.unmount());
      host.remove();
    };
    return { host, cleanup };
  }
  const press = (host: HTMLElement, label: string) =>
    act(() =>
      [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(label))!.click(),
    );

  it('clicking a card selects its filter', () => {
    const onSelect = vi.fn();
    const { host, cleanup } = mount(dashboard, onSelect);
    press(host, 'Pro');
    press(host, 'Gói trả phí hết hạn');
    expect(onSelect.mock.calls).toEqual([['pro'], ['expiring']]);
    cleanup();
  });

  it('still filters, without counts, while the dashboard is loading or failed', () => {
    const onSelect = vi.fn();
    const { host, cleanup } = mount(null, onSelect);
    expect(host.querySelectorAll('button')).toHaveLength(5);
    expect(host.textContent).toContain('Chưa đủ dữ liệu');
    expect(host.textContent).not.toContain('Doanh thu');
    press(host, 'Ultra');
    expect(onSelect).toHaveBeenCalledWith('ultra');
    cleanup();
  });
});

describe('usage meter in a row', () => {
  it('measures the month against the plan allowance and flags 80% and 100%', () => {
    const hour = 3_600_000;
    expect(rowUsage({ plan: 'free', translationMsThisMonth: 0 }).state).toBe('ok');
    expect(rowUsage({ plan: 'free', translationMsThisMonth: 1.7 * hour }).state).toBe('low');
    expect(rowUsage({ plan: 'free', translationMsThisMonth: 2 * hour }).state).toBe('exhausted');
  });
});
