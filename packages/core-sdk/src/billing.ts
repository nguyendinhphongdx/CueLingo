import {
  BillingOrderListSchema,
  BillingOrderSchema,
  BillingOverviewResponseSchema,
  type BillingOrder,
  type BillingOrderList,
  type BillingOverviewResponse,
  type CreateOrderRequest,
} from '@cuelingo/shared';
import type { Http } from './http';

export function billingApi(http: Http) {
  return {
    /** What can be bought and the plan in force. `enabled: false` means hide the upgrade button. */
    overview(): Promise<BillingOverviewResponse> {
      return http.request('GET', '/v1/billing', BillingOverviewResponseSchema);
    },
    /**
     * Starts a purchase. Only the plan and period are sent: the price is the server's. Asking again for the same
     * offer returns the open order. Errors: `BILLING_DISABLED` (503), `PLAN_DOWNGRADE` (409),
     * `BILLING_PROVIDER_FAILED` (502), `RATE_LIMITED` (429).
     */
    createOrder(input: CreateOrderRequest): Promise<BillingOrder> {
      return http.request('POST', '/v1/billing/orders', BillingOrderSchema, input);
    },
    /** Poll this (about every 3 s) while the QR is shown; it turns `paid` when the money arrives. */
    getOrder(id: string, init?: { signal?: AbortSignal }): Promise<BillingOrder> {
      return http.request(
        'GET',
        `/v1/billing/orders/${encodeURIComponent(id)}`,
        BillingOrderSchema,
        undefined,
        init,
      );
    },
    /** The signed-in user's own orders, newest first. */
    async listOrders(): Promise<BillingOrderList['items']> {
      return (await http.request('GET', '/v1/billing/orders', BillingOrderListSchema)).items;
    },
  };
}
