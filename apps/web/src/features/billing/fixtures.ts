import type { BillingOffer, BillingOrder, BillingOverviewResponse } from '@cuelingo/shared';

const HOUR = 3_600_000;

const limits = (translation: number, agent: number | null): BillingOffer['limits'] => ({
  translation_ms: translation,
  cloud_stt_ms: translation / 2,
  debriefs: null,
  assist_daily: null,
  agent_messages: agent,
});

/** Offers as the server sends them: prices from `PLAN_PRICES` defaults. Test data only. */
export const OFFERS: BillingOffer[] = [
  { plan: 'pro', period: 'month', amount: 99_000, limits: limits(20 * HOUR, 100) },
  { plan: 'pro', period: 'year', amount: 990_000, limits: limits(20 * HOUR, 100) },
  { plan: 'ultra', period: 'month', amount: 249_000, limits: limits(60 * HOUR, null) },
  { plan: 'ultra', period: 'year', amount: 2_490_000, limits: limits(60 * HOUR, null) },
];

export function overview(
  current: Partial<BillingOverviewResponse['current']> = {},
  offers: BillingOffer[] = OFFERS,
): BillingOverviewResponse {
  return {
    enabled: offers.length > 0,
    current: { plan: 'free', expiresAt: null, source: null, ...current },
    offers,
  };
}

export function order(patch: Partial<BillingOrder> = {}): BillingOrder {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    plan: 'pro',
    period: 'month',
    amount: 99_000,
    status: 'pending',
    transferContent: 'CL123456',
    qrCode: '00020101021238570010A000000727',
    checkoutUrl: 'https://pay.payos.vn/web/abc',
    createdAt: '2026-11-15T10:00:00.000Z',
    expiresAt: '2026-11-15T10:15:00.000Z',
    paidAt: null,
    planExpiresAt: null,
    ...patch,
  };
}
