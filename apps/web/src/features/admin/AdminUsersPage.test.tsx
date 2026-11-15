import type { AdminDashboard, AdminUserRow } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/users', notFound: vi.fn() }));

import { AdminDashboardView, AdminUserTable } from './AdminUsersPage';
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
    expect(markup).toContain('1 giờ 30 phút');
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
