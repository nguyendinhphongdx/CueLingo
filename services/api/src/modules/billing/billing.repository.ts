import {
  planAfterPurchase,
  type BillingOrderStatus,
  type BillingPeriod,
  type PaidPlan,
  type PlanPriceTable,
  type PlanRow,
  type PlanSource,
} from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

/** An order as stored. Holds no payer bank data: the adapter drops it before anything reaches here. */
export interface OrderRow {
  id: string;
  userId: string;
  orderCode: number;
  provider: string;
  plan: PaidPlan;
  period: BillingPeriod;
  amount: number;
  status: BillingOrderStatus;
  providerLinkId: string | null;
  /** The bank's transaction reference, kept to match a payment by hand. Never logged, never sent to a client. */
  providerRef: string | null;
  qrCode: string | null;
  checkoutUrl: string | null;
  expiresAt: Date;
  paidAt: Date | null;
  planExpiresAt: Date | null;
  checkedAt: Date | null;
  createdAt: Date;
}

export interface NewOrder {
  provider: string;
  plan: PaidPlan;
  period: BillingPeriod;
  amount: number;
  expiresAt: Date;
}

export interface SettleInput {
  paidAt: Date;
  now: Date;
  /** The bank's transaction reference from the provider, if it sent one. */
  reference?: string | null;
  prices: PlanPriceTable;
}

export interface SettleResult {
  /** False when another request already settled the order (a repeated or parallel webhook). */
  settled: boolean;
  /** False when the plan could not follow the purchase (the user holds a higher plan now): refund by hand. */
  applied: boolean;
  order: OrderRow;
}

/**
 * Data access for orders. Methods that take a `userId` filter by it. The two that do not (`findByOrderCode`,
 * `settle`) serve the webhook, where the caller is the payment provider and the key is the order code.
 */
export interface BillingRepository {
  currentPlan(userId: string): Promise<PlanRow | null>;
  /** Inserts a pending order with a fresh `order_code`. */
  createOrder(userId: string, input: NewOrder): Promise<OrderRow>;
  attachCheckout(
    userId: string,
    id: string,
    checkout: { linkId: string; qrCode: string; checkoutUrl: string },
  ): Promise<OrderRow | null>;
  /** The newest still-open order of this user for the same offer, if it has a checkout. */
  findOpenOrder(
    userId: string,
    plan: PaidPlan,
    period: BillingPeriod,
    now: Date,
  ): Promise<OrderRow | null>;
  countCreatedSince(userId: string, since: Date): Promise<number>;
  getForUser(userId: string, id: string): Promise<OrderRow | null>;
  listForUser(userId: string, limit: number): Promise<OrderRow[]>;
  findByOrderCode(orderCode: number): Promise<OrderRow | null>;
  /** `pending` -> `cancelled` or `expired`. Returns the order as it is afterwards. */
  closePending(id: string, status: 'cancelled' | 'expired'): Promise<OrderRow | null>;
  markChecked(id: string, at: Date): Promise<void>;
  /**
   * Marks the order paid and moves the plan, in one transaction (AC3, AC8). Only one caller wins for an order,
   * and plan updates of one user are serialised, so parallel webhooks add the period once.
   */
  settle(orderCode: number, input: SettleInput): Promise<SettleResult | null>;
}

interface OrderDbRow {
  id: string;
  user_id: string;
  order_code: number;
  provider: string;
  plan: PaidPlan;
  period: BillingPeriod;
  amount: number;
  status: BillingOrderStatus;
  provider_link_id: string | null;
  provider_ref: string | null;
  qr_code: string | null;
  checkout_url: string | null;
  expires_at: Date;
  paid_at: Date | null;
  plan_expires_at: Date | null;
  checked_at: Date | null;
  created_at: Date;
}

const toOrder = (r: OrderDbRow): OrderRow => ({
  id: r.id,
  userId: r.user_id,
  orderCode: r.order_code,
  provider: r.provider,
  plan: r.plan,
  period: r.period,
  amount: r.amount,
  status: r.status,
  providerLinkId: r.provider_link_id,
  providerRef: r.provider_ref,
  qrCode: r.qr_code,
  checkoutUrl: r.checkout_url,
  expiresAt: r.expires_at,
  paidAt: r.paid_at,
  planExpiresAt: r.plan_expires_at,
  checkedAt: r.checked_at,
  createdAt: r.created_at,
});

export function createPostgresBillingRepository(sql: Sql): BillingRepository {
  return {
    async currentPlan(userId) {
      const [row] = await sql<
        { plan: PlanRow['plan']; expires_at: Date | null; source: PlanSource }[]
      >`
        SELECT plan, expires_at, source FROM user_plans WHERE user_id = ${userId}`;
      return row ? { plan: row.plan, expiresAt: row.expires_at, source: row.source } : null;
    },

    async createOrder(userId, input) {
      const [row] = await sql<OrderDbRow[]>`
        INSERT INTO billing_orders (user_id, order_code, provider, plan, period, amount, expires_at)
        VALUES (${userId}, nextval('billing_order_code_seq'), ${input.provider}, ${input.plan},
          ${input.period}, ${input.amount}, ${input.expiresAt})
        RETURNING *`;
      return toOrder(row!);
    },

    async attachCheckout(userId, id, checkout) {
      const [row] = await sql<OrderDbRow[]>`
        UPDATE billing_orders
        SET provider_link_id = ${checkout.linkId}, qr_code = ${checkout.qrCode},
          checkout_url = ${checkout.checkoutUrl}
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *`;
      return row ? toOrder(row) : null;
    },

    async findOpenOrder(userId, plan, period, now) {
      const [row] = await sql<OrderDbRow[]>`
        SELECT * FROM billing_orders
        WHERE user_id = ${userId} AND plan = ${plan} AND period = ${period}
          AND status = 'pending' AND expires_at > ${now} AND qr_code IS NOT NULL
        ORDER BY created_at DESC LIMIT 1`;
      return row ? toOrder(row) : null;
    },

    async countCreatedSince(userId, since) {
      const [row] = await sql<{ n: string }[]>`
        SELECT count(*) AS n FROM billing_orders WHERE user_id = ${userId} AND created_at > ${since}`;
      return Number(row?.n ?? 0);
    },

    async getForUser(userId, id) {
      const [row] = await sql<OrderDbRow[]>`
        SELECT * FROM billing_orders WHERE id = ${id} AND user_id = ${userId}`;
      return row ? toOrder(row) : null;
    },

    async listForUser(userId, limit) {
      const rows = await sql<OrderDbRow[]>`
        SELECT * FROM billing_orders WHERE user_id = ${userId}
        ORDER BY created_at DESC LIMIT ${limit}`;
      return rows.map(toOrder);
    },

    async findByOrderCode(orderCode) {
      const [row] = await sql<OrderDbRow[]>`
        SELECT * FROM billing_orders WHERE order_code = ${orderCode}`;
      return row ? toOrder(row) : null;
    },

    async closePending(id, status) {
      await sql`UPDATE billing_orders SET status = ${status} WHERE id = ${id} AND status = 'pending'`;
      const [row] = await sql<OrderDbRow[]>`SELECT * FROM billing_orders WHERE id = ${id}`;
      return row ? toOrder(row) : null;
    },

    async markChecked(id, at) {
      await sql`UPDATE billing_orders SET checked_at = ${at} WHERE id = ${id}`;
    },

    async settle(orderCode, input) {
      return sql.begin(async (tx) => {
        // Only one transaction can flip the order; a parallel one waits on the row, then finds it already paid.
        // An `expired` order still counts: the payment may have been made inside its window (G3).
        const [won] = await tx<OrderDbRow[]>`
          UPDATE billing_orders SET status = 'paid', paid_at = ${input.paidAt}, provider_ref = ${input.reference ?? null}
          WHERE order_code = ${orderCode} AND status IN ('pending', 'expired')
          RETURNING *`;
        if (!won) {
          const [existing] = await tx<OrderDbRow[]>`
            SELECT * FROM billing_orders WHERE order_code = ${orderCode}`;
          return existing ? { settled: false, applied: false, order: toOrder(existing) } : null;
        }
        // Make sure the row exists so FOR UPDATE has something to lock for a user's first purchase.
        await tx`
          INSERT INTO user_plans (user_id, plan, source) VALUES (${won.user_id}, 'free', 'payment')
          ON CONFLICT (user_id) DO NOTHING`;
        const [plan] = await tx<
          { plan: PlanRow['plan']; expires_at: Date | null; source: PlanSource }[]
        >`
          SELECT plan, expires_at, source FROM user_plans WHERE user_id = ${won.user_id} FOR UPDATE`;
        const outcome = planAfterPurchase({
          current: plan
            ? { plan: plan.plan, expiresAt: plan.expires_at, source: plan.source }
            : null,
          now: input.now,
          plan: won.plan,
          period: won.period,
          prices: input.prices,
        });
        if (!outcome.ok) {
          return { settled: true, applied: false, order: toOrder(won) };
        }
        await tx`
          UPDATE user_plans
          SET plan = ${outcome.plan}, expires_at = ${outcome.expiresAt}, source = 'payment',
            set_by = NULL, updated_at = now()
          WHERE user_id = ${won.user_id}`;
        const [done] = await tx<OrderDbRow[]>`
          UPDATE billing_orders SET plan_expires_at = ${outcome.expiresAt}
          WHERE id = ${won.id} RETURNING *`;
        return { settled: true, applied: true, order: toOrder(done!) };
      });
    },
  };
}
