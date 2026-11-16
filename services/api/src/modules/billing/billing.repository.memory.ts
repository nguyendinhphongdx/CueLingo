import { planAfterAdminGrant, planAfterPurchase } from '@cuelingo/shared';
import type { InMemoryPlanRows } from '../usage';
import {
  ADMIN_PROVIDER,
  type BillingRepository,
  type OrderRow,
  type SettleResult,
} from './billing.repository';

/**
 * In-memory implementation with the same contract. Pass the map the in-memory usage repository uses so a paid
 * order changes the plan that `GET /v1/me/usage` reads.
 */
export function createInMemoryBillingRepository(
  plans: InMemoryPlanRows = new Map(),
  now: () => Date = () => new Date(),
): BillingRepository {
  const orders: OrderRow[] = [];
  let nextCode = 1_000_000;
  let nextId = 1;

  const byId = (id: string) => orders.find((o) => o.id === id) ?? null;
  const patch = (order: OrderRow, changes: Partial<OrderRow>): OrderRow => {
    Object.assign(order, changes);
    return { ...order };
  };

  return {
    async currentPlan(userId) {
      const row = plans.get(userId);
      return row ? { ...row } : null;
    },

    async createOrder(userId, input) {
      const order: OrderRow = {
        id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`,
        userId,
        orderCode: nextCode++,
        ...input,
        status: 'pending',
        providerLinkId: null,
        providerRef: null,
        qrCode: null,
        checkoutUrl: null,
        paidAt: null,
        planExpiresAt: null,
        checkedAt: null,
        createdAt: now(),
      };
      orders.push(order);
      return { ...order };
    },

    async attachCheckout(userId, id, checkout) {
      const order = byId(id);
      if (!order || order.userId !== userId) return null;
      return patch(order, {
        providerLinkId: checkout.linkId,
        qrCode: checkout.qrCode,
        checkoutUrl: checkout.checkoutUrl,
      });
    },

    async findOpenOrder(userId, plan, period, at) {
      const found = orders
        .filter(
          (o) =>
            o.userId === userId &&
            o.plan === plan &&
            o.period === period &&
            o.status === 'pending' &&
            o.expiresAt > at &&
            o.qrCode !== null,
        )
        .at(-1);
      return found ? { ...found } : null;
    },

    async countCreatedSince(userId, since) {
      return orders.filter(
        (o) => o.userId === userId && o.createdAt > since && o.provider !== ADMIN_PROVIDER,
      ).length;
    },

    async getForUser(userId, id) {
      const order = byId(id);
      return order && order.userId === userId ? { ...order } : null;
    },

    async listForUser(userId, limit) {
      return orders
        .filter((o) => o.userId === userId)
        .reverse()
        .slice(0, limit)
        .map((o) => ({ ...o }));
    },

    async findByOrderCode(orderCode) {
      const order = orders.find((o) => o.orderCode === orderCode);
      return order ? { ...order } : null;
    },

    async closePending(id, status) {
      const order = byId(id);
      if (!order) return null;
      return order.status === 'pending' ? patch(order, { status }) : { ...order };
    },

    async markChecked(id, at) {
      const order = byId(id);
      if (order) order.checkedAt = at;
    },

    // No await inside: like the SQL transaction, it cannot interleave with another call.
    async settle(orderCode, input): Promise<SettleResult | null> {
      const order = orders.find((o) => o.orderCode === orderCode);
      if (!order) return null;
      if (order.status !== 'pending' && order.status !== 'expired') {
        return { settled: false, applied: false, order: { ...order } };
      }
      order.status = 'paid';
      order.paidAt = input.paidAt;
      order.providerRef = input.reference ?? null;
      const outcome = planAfterPurchase({
        current: plans.get(order.userId) ?? null,
        now: input.now,
        plan: order.plan,
        period: order.period,
        prices: input.prices,
      });
      if (!outcome.ok) return { settled: true, applied: false, order: { ...order } };
      plans.set(order.userId, {
        plan: outcome.plan,
        expiresAt: outcome.expiresAt,
        source: 'payment',
      });
      order.planExpiresAt = outcome.expiresAt;
      return { settled: true, applied: true, order: { ...order } };
    },

    // No await inside, like the SQL transaction.
    async grant(userId, input) {
      const previous = plans.get(userId) ? { ...plans.get(userId)! } : null;
      const outcome = planAfterAdminGrant({
        current: previous,
        now: input.now,
        plan: input.plan,
        period: input.period,
        prices: input.prices,
      });
      const current = {
        plan: outcome.plan,
        expiresAt: outcome.expiresAt,
        source: 'manual' as const,
      };
      plans.set(userId, current);
      let orderId: string | null = null;
      if (outcome.plan !== 'free' && input.period) {
        const order: OrderRow = {
          id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`,
          userId,
          orderCode: nextCode++,
          provider: ADMIN_PROVIDER,
          plan: outcome.plan,
          period: input.period,
          amount: 0,
          status: 'paid',
          providerLinkId: null,
          providerRef: null,
          qrCode: null,
          checkoutUrl: null,
          expiresAt: input.now,
          paidAt: input.now,
          planExpiresAt: outcome.expiresAt,
          checkedAt: null,
          createdAt: input.now,
        };
        orders.push(order);
        orderId = order.id;
      }
      return { previous, current, orderId };
    },
  };
}
