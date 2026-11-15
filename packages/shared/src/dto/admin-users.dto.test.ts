import { describe, expect, it } from 'vitest';
import {
  AdminDashboardSchema,
  AdminSetUserPlanRequestSchema,
  AdminUserDetailSchema,
  AdminUserListQuerySchema,
  AdminUserOrderSchema,
  AdminUserRowSchema,
} from './admin-users.dto';

const row = {
  id: '0b9f2f5e-7c52-4d57-9d4c-1f5f3a7a9a10',
  email: 'a@example.com',
  name: 'A',
  createdAt: '2026-11-01T00:00:00.000Z',
  plan: 'free',
  source: null,
  expiresAt: null,
  translationMsThisMonth: 0,
  lastActiveAt: null,
};

describe('admin users contract', () => {
  it('accepts a dashboard and refuses extra fields', () => {
    const dashboard = {
      generatedAt: '2026-11-15T00:00:00.000Z',
      totalUsers: 3,
      byPlan: { free: 1, pro: 1, ultra: 1 },
      newUsers7d: 1,
      revenueThisMonth: 99000,
      expiringIn7d: 0,
    };
    expect(AdminDashboardSchema.safeParse(dashboard).success).toBe(true);
    expect(AdminDashboardSchema.safeParse({ ...dashboard, emails: [] }).success).toBe(false);
  });

  it('trims the search text and caps it at 100 characters', () => {
    expect(AdminUserListQuerySchema.parse({ q: '  bob ' }).q).toBe('bob');
    expect(AdminUserListQuerySchema.safeParse({ q: 'x'.repeat(101) }).success).toBe(false);
    expect(AdminUserListQuerySchema.safeParse({ expiring: '0' }).success).toBe(false);
    expect(AdminUserListQuerySchema.safeParse({ plan: 'gold' }).success).toBe(false);
    expect(AdminUserListQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('keeps the row and the order free of meeting content and payment links', () => {
    expect(AdminUserRowSchema.safeParse(row).success).toBe(true);
    expect(AdminUserRowSchema.safeParse({ ...row, title: 'Board meeting' }).success).toBe(false);
    const order = {
      id: row.id,
      plan: 'pro',
      period: 'month',
      amount: 99000,
      status: 'paid',
      createdAt: row.createdAt,
      paidAt: row.createdAt,
      planExpiresAt: null,
    };
    expect(AdminUserOrderSchema.safeParse(order).success).toBe(true);
    expect(AdminUserOrderSchema.safeParse({ ...order, qrCode: '000201' }).success).toBe(false);
    expect(AdminUserDetailSchema.safeParse({ user: row, orders: [] }).success).toBe(false);
  });

  it('takes only plan and an optional end date; the person is never in the body', () => {
    expect(AdminSetUserPlanRequestSchema.safeParse({ plan: 'pro' }).success).toBe(true);
    expect(
      AdminSetUserPlanRequestSchema.safeParse({ plan: 'pro', expiresAt: '2027-01-01T00:00:00Z' })
        .success,
    ).toBe(true);
    expect(AdminSetUserPlanRequestSchema.safeParse({ plan: 'pro', userId: row.id }).success).toBe(
      false,
    );
    expect(AdminSetUserPlanRequestSchema.safeParse({ plan: 'gold' }).success).toBe(false);
  });
});
