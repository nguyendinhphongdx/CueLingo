import {
  effectivePlan,
  periodEnd,
  periodStart,
  type AdminDashboard,
  type AdminUserRow,
} from '@cuelingo/shared';
import type { InMemoryPlanRows } from '../usage';
import {
  EXPIRING_DAYS,
  type AdminUsersRepository,
  type UserCursor,
} from './admin-users.repository';

export interface InMemoryAdminUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  translationMs?: number;
  lastActiveAt?: Date | null;
}

export interface InMemoryPaidOrder {
  amount: number;
  paidAt: Date;
}

const DAY_MS = 86_400_000;

/** Same contract as the Postgres one. `plans` is shared with the usage and billing in-memory repositories. */
export function createInMemoryAdminUsersRepository(
  users: readonly InMemoryAdminUser[] = [],
  plans: InMemoryPlanRows = new Map(),
  paidOrders: readonly InMemoryPaidOrder[] = [],
): AdminUsersRepository {
  const toRow = (u: InMemoryAdminUser, now: Date): AdminUserRow => {
    const stored = plans.get(u.id) ?? null;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.createdAt.toISOString(),
      plan: effectivePlan(stored, now),
      source: stored?.source ?? null,
      expiresAt: stored?.expiresAt?.toISOString() ?? null,
      translationMsThisMonth: u.translationMs ?? 0,
      lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
    };
  };
  const newestFirst = (a: InMemoryAdminUser, b: InMemoryAdminUser) =>
    b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1);
  const endsSoon = (id: string, now: Date) => {
    const end = plans.get(id)?.expiresAt;
    const plan = plans.get(id)?.plan;
    return (
      plan !== undefined &&
      plan !== 'free' &&
      !!end &&
      end.getTime() > now.getTime() &&
      end.getTime() <= now.getTime() + EXPIRING_DAYS * DAY_MS
    );
  };
  const before = (u: InMemoryAdminUser, cursor: UserCursor) => {
    const at = u.createdAt.getTime();
    const cut = new Date(cursor.createdAt).getTime();
    return at < cut || (at === cut && u.id < cursor.id);
  };

  return {
    async dashboard(now): Promise<AdminDashboard> {
      const count = (plan: 'pro' | 'ultra') =>
        users.filter((u) => effectivePlan(plans.get(u.id) ?? null, now) === plan).length;
      const pro = count('pro');
      const ultra = count('ultra');
      const from = periodStart('translation_ms', now).getTime();
      const to = periodEnd('translation_ms', now).getTime();
      return {
        generatedAt: now.toISOString(),
        totalUsers: users.length,
        byPlan: { free: users.length - pro - ultra, pro, ultra },
        newUsers7d: users.filter((u) => u.createdAt.getTime() >= now.getTime() - 7 * DAY_MS).length,
        revenueThisMonth: paidOrders
          .filter((o) => o.paidAt.getTime() >= from && o.paidAt.getTime() < to)
          .reduce((sum, o) => sum + o.amount, 0),
        expiringIn7d: users.filter((u) => endsSoon(u.id, now)).length,
      };
    },

    async list(filter, now, limit) {
      const q = filter.q?.toLowerCase();
      const matches = [...users]
        .sort(newestFirst)
        .filter((u) => !q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
        .filter((u) => !filter.plan || effectivePlan(plans.get(u.id) ?? null, now) === filter.plan)
        .filter((u) => !filter.expiring || endsSoon(u.id, now))
        .filter((u) => !filter.after || before(u, filter.after));
      const page = matches.slice(0, limit);
      const last = page[page.length - 1];
      return {
        items: page.map((u) => toRow(u, now)),
        next:
          matches.length > limit && last
            ? { createdAt: last.createdAt.toISOString(), id: last.id }
            : null,
      };
    },

    async find(id, now) {
      const user = users.find((u) => u.id === id);
      return user ? toRow(user, now) : null;
    },
  };
}
