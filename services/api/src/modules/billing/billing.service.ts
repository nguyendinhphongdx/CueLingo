import {
  ErrorCode,
  PaidPlanSchema,
  BillingPeriodSchema,
  effectivePlan,
  planAfterPurchase,
  type BillingOffer,
  type BillingOrder,
  type BillingOrderList,
  type BillingOverviewResponse,
  type CreateOrderRequest,
  type PlanLimitTable,
  type PlanPriceTable,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { BillingRepository, OrderRow } from './billing.repository';
import type { PaymentProvider } from './providers/provider';

export type BillingService = ReturnType<typeof createBillingService>;

/** Only what the service writes to the log: order codes and outcomes, never keys, signatures or payer data. */
export interface BillingLog {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
}

export interface BillingOptions {
  /** Absent = upgrading is off (no PayOS keys): the overview says so and creating an order answers 503. */
  provider?: PaymentProvider;
  prices: PlanPriceTable;
  limits: PlanLimitTable;
  /** Origin of apps/web, where the payer returns to. */
  webOrigin: string;
  log: BillingLog;
  now?: () => Date;
  /** How long an order accepts payment (Q3). */
  orderTtlMs?: number;
  /** Ask the provider again only if the last check is older than this (AC5 polling). */
  statusRecheckMs?: number;
  /** Orders one person may create per hour. */
  ordersPerHour?: number;
}

const HISTORY_LIMIT = 50;

/** Orders, payment confirmation and plan changes. The provider sits behind {@link PaymentProvider}. */
export function createBillingService(repo: BillingRepository, options: BillingOptions) {
  const now = options.now ?? (() => new Date());
  const ttlMs = options.orderTtlMs ?? 15 * 60_000;
  const recheckMs = options.statusRecheckMs ?? 15_000;
  const perHour = options.ordersPerHour ?? 10;
  const { provider, prices, log } = options;

  /** An order as the client sees it. A `pending` order past its time is shown as `expired` without a write. */
  function toDto(order: OrderRow): BillingOrder {
    const at = now();
    const status =
      order.status === 'pending' && order.expiresAt.getTime() <= at.getTime()
        ? 'expired'
        : order.status;
    const open = status === 'pending';
    return {
      id: order.id,
      plan: order.plan,
      period: order.period,
      amount: order.amount,
      status,
      transferContent: `CL${order.orderCode}`,
      qrCode: open ? order.qrCode : null,
      checkoutUrl: open ? order.checkoutUrl : null,
      createdAt: order.createdAt.toISOString(),
      expiresAt: order.expiresAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      planExpiresAt: order.planExpiresAt?.toISOString() ?? null,
      // `settle` sets `plan_expires_at` only when the plan moved, so no new column is needed.
      planApplied: status === 'paid' && order.planExpiresAt !== null,
    };
  }

  /**
   * Turns a confirmed payment into a paid order and a plan change. Used by the webhook and by the status
   * fallback, so both take the same path. Returns quietly when the order is already paid.
   */
  async function applyPayment(
    order: OrderRow,
    payment: { amount: number; transactionAt: Date | null },
  ): Promise<void> {
    if (order.status === 'paid') return;
    if (order.status === 'cancelled') {
      log.warn(
        { orderCode: order.orderCode },
        'payment arrived for a cancelled order, refund by hand',
      );
      return;
    }
    const at = now();
    const paidAt = payment.transactionAt ?? at;
    // G3: money counts if it arrived inside the order's window, even when we hear about it later.
    if (paidAt.getTime() > order.expiresAt.getTime()) {
      log.warn(
        { orderCode: order.orderCode },
        'payment arrived after the order expired, refund by hand',
      );
      return;
    }
    const result = await repo.settle(order.orderCode, { paidAt, now: at, prices });
    if (!result?.settled) return; // another request got there first: the period is not added twice
    if (!result.applied) {
      log.warn(
        { orderCode: order.orderCode },
        'order paid but the plan did not change, refund by hand',
      );
      return;
    }
    log.info({ orderCode: order.orderCode }, 'order paid');
  }

  /** The offers this person may buy now: every plan and period except a lower plan than the one in force (G2). */
  async function offersFor(userId: string): Promise<BillingOffer[]> {
    const current = await repo.currentPlan(userId);
    const at = now();
    const offers: BillingOffer[] = [];
    for (const plan of PaidPlanSchema.options) {
      for (const period of BillingPeriodSchema.options) {
        const outcome = planAfterPurchase({ current, now: at, plan, period, prices });
        if (!outcome.ok) continue;
        offers.push({
          plan,
          period,
          amount: prices[plan][period],
          limits: { ...options.limits[plan] },
        });
      }
    }
    return offers;
  }

  /** Asks the provider once if it was not asked lately; a lost webhook must not strand a paid order (AC5). */
  async function refreshFromProvider(order: OrderRow): Promise<OrderRow> {
    if (!provider || order.status !== 'pending') return order;
    const at = now();
    if (order.checkedAt && at.getTime() - order.checkedAt.getTime() < recheckMs) return order;
    await repo.markChecked(order.id, at);
    try {
      const state = await provider.getStatus(order.orderCode);
      if (state.status === 'paid' && state.amountPaid === order.amount) {
        await applyPayment(order, { amount: state.amountPaid, transactionAt: state.transactionAt });
      } else if (state.status === 'cancelled') {
        await repo.closePending(order.id, 'cancelled');
      }
    } catch {
      // The provider being slow must not fail the read; the next poll asks again.
      log.warn({ orderCode: order.orderCode }, 'payment status check failed');
    }
    return (await repo.findByOrderCode(order.orderCode)) ?? order;
  }

  return {
    /** AC1, AC11: what can be bought, from the server's price table. */
    async overview(userId: string): Promise<BillingOverviewResponse> {
      const row = await repo.currentPlan(userId);
      const at = now();
      const plan = effectivePlan(row, at);
      const live = plan !== 'free' && row;
      return {
        enabled: Boolean(provider),
        current: {
          plan,
          expiresAt: live && row.expiresAt ? row.expiresAt.toISOString() : null,
          source: live ? row.source : null,
        },
        offers: provider ? await offersFor(userId) : [],
      };
    },

    /** AC2: a pending order for the offer, with the price chosen here. Asking again returns the open one. */
    async createOrder(userId: string, input: CreateOrderRequest): Promise<BillingOrder> {
      if (!provider) throw new AppError(ErrorCode.BillingDisabled, 'Upgrading is not available');
      const at = now();
      const outcome = planAfterPurchase({
        current: await repo.currentPlan(userId),
        now: at,
        plan: input.plan,
        period: input.period,
        prices,
      });
      if (!outcome.ok) {
        throw new AppError(ErrorCode.PlanDowngrade, 'This plan is not higher than the current one');
      }
      const open = await repo.findOpenOrder(userId, input.plan, input.period, at);
      if (open) return toDto(open);
      if ((await repo.countCreatedSince(userId, new Date(at.getTime() - 3_600_000))) >= perHour) {
        throw new AppError(ErrorCode.RateLimited, 'Too many orders, try again later');
      }

      const order = await repo.createOrder(userId, {
        provider: provider.name,
        plan: input.plan,
        period: input.period,
        amount: prices[input.plan][input.period],
        expiresAt: new Date(at.getTime() + ttlMs),
      });
      const back = `${options.webOrigin.replace(/\/$/, '')}/checkout?order=${order.id}`;
      try {
        const checkout = await provider.createCheckout({
          orderCode: order.orderCode,
          amount: order.amount,
          description: `CL${order.orderCode}`,
          returnUrl: back,
          cancelUrl: `${back}&cancelled=1`,
          expiresAt: order.expiresAt,
        });
        const saved = await repo.attachCheckout(userId, order.id, checkout);
        return toDto(saved ?? order);
      } catch {
        await repo.closePending(order.id, 'cancelled');
        log.warn(
          { orderCode: order.orderCode },
          'payment provider refused to create a payment link',
        );
        throw new AppError(ErrorCode.BillingProviderFailed, 'Could not create the payment');
      }
    },

    /** AC9: only the caller's orders, newest first. */
    async listOrders(userId: string): Promise<BillingOrderList> {
      return { items: (await repo.listForUser(userId, HISTORY_LIMIT)).map(toDto) };
    },

    /** AC5, AC6: one order of the caller; settles a payment the webhook has not delivered, and expires a late one. */
    async getOrder(userId: string, id: string): Promise<BillingOrder> {
      let order = await repo.getForUser(userId, id);
      if (!order) throw new AppError(ErrorCode.NotFound, 'Order not found');
      order = await refreshFromProvider(order);
      if (order.status === 'pending' && order.expiresAt.getTime() <= now().getTime()) {
        order = (await repo.closePending(order.id, 'expired')) ?? order;
      }
      return toDto(order);
    },

    /**
     * AC3, AC4: the provider's call. Signature wrong or amount different -> 400. Unknown order code with a good
     * signature -> acknowledged without changes (G1), because PayOS sends such a sample when a URL is registered.
     */
    async handleWebhook(body: unknown): Promise<void> {
      if (!provider) throw new AppError(ErrorCode.BillingDisabled, 'Upgrading is not available');
      const verdict = provider.verifyWebhook(body);
      if (verdict.kind === 'invalid') {
        log.warn({}, 'payment webhook rejected: bad signature');
        throw new AppError(ErrorCode.Validation, 'Invalid webhook');
      }
      if (verdict.kind === 'ignored') return;

      const { event } = verdict;
      const order = await repo.findByOrderCode(event.orderCode);
      if (!order) {
        log.info({ orderCode: event.orderCode }, 'payment webhook for an unknown order, ignored');
        return;
      }
      if (event.amount !== order.amount) {
        log.warn(
          { orderCode: order.orderCode },
          'payment webhook rejected: amount differs from the order',
        );
        throw new AppError(ErrorCode.Validation, 'Invalid webhook');
      }
      await applyPayment(order, { amount: event.amount, transactionAt: event.transactionAt });
    },
  };
}
