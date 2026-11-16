/**
 * Billing module — buying Pro/Ultra by VietQR through PayOS (spec 2026-11-15-w2-03-vietqr-upgrade).
 * Design: apps/docs/docs/04-modules/03-api/billing.md · ADR 0023
 */
import { billingRoutes } from './billing.routes';
import { createBillingService, type BillingOptions } from './billing.service';
import type { BillingRepository } from './billing.repository';

export function createBillingModule(repo: BillingRepository, options: BillingOptions) {
  const service = createBillingService(repo, options);
  return { service, routes: billingRoutes(service) };
}

export type { BillingOptions, BillingService } from './billing.service';
export type { BillingRepository, GrantResult } from './billing.repository';
export type { PaymentProvider } from './providers/provider';
export { createPostgresBillingRepository } from './billing.repository';
export { createInMemoryBillingRepository } from './billing.repository.memory';
export { createPayosProvider } from './providers/payos';
export { createFakeProvider, type FakeProvider } from './providers/fake';
