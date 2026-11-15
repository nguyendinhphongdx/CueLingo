import type {
  Checkout,
  CheckoutRequest,
  PaymentProvider,
  ProviderPaymentState,
  ProviderStatus,
  WebhookVerdict,
} from './provider';

/**
 * A provider for tests: no network and no real signature scheme. A webhook is valid when its `signature` is
 * `'valid'`. Use {@link FakeProvider.webhook} to build bodies and {@link FakeProvider.setState} to move an order.
 */
export interface FakeProvider extends PaymentProvider {
  readonly created: CheckoutRequest[];
  /** The next `createCheckout` throws, once. */
  failNextCheckout(): void;
  /** What `getStatus` will answer for this order. */
  setState(
    orderCode: number,
    state: Partial<ProviderPaymentState> & { status: ProviderStatus },
  ): void;
  statusCalls: number[];
  /** A webhook body as the provider would send it. */
  webhook(input: {
    orderCode: number;
    amount: number;
    transactionDateTime?: string;
    code?: string;
    signature?: string;
  }): unknown;
}

export function createFakeProvider(): FakeProvider {
  const created: CheckoutRequest[] = [];
  const states = new Map<number, ProviderPaymentState>();
  let failNext = false;
  const statusCalls: number[] = [];

  return {
    name: 'fake',
    created,
    statusCalls,
    failNextCheckout() {
      failNext = true;
    },
    setState(orderCode, state) {
      states.set(orderCode, { amountPaid: 0, transactionAt: null, reference: null, ...state });
    },
    async createCheckout(request): Promise<Checkout> {
      if (failNext) {
        failNext = false;
        throw new Error('fake provider is down');
      }
      created.push(request);
      return {
        linkId: `link-${request.orderCode}`,
        qrCode: `FAKEQR${request.orderCode}`,
        checkoutUrl: `https://pay.example/${request.orderCode}`,
      };
    },
    verifyWebhook(body): WebhookVerdict {
      const b = body as {
        code?: string;
        signature?: string;
        data?: { orderCode?: number; amount?: number; transactionDateTime?: string };
      } | null;
      if (!b || b.signature !== 'valid' || !b.data) return { kind: 'invalid' };
      if (b.code !== '00') return { kind: 'ignored' };
      const { orderCode, amount, transactionDateTime } = b.data;
      if (typeof orderCode !== 'number' || typeof amount !== 'number') return { kind: 'invalid' };
      return {
        kind: 'paid',
        event: {
          orderCode,
          amount,
          transactionAt: transactionDateTime ? new Date(transactionDateTime) : null,
          reference: null,
        },
      };
    },
    async getStatus(orderCode) {
      statusCalls.push(orderCode);
      return (
        states.get(orderCode) ?? {
          status: 'pending',
          amountPaid: 0,
          transactionAt: null,
          reference: null,
        }
      );
    },
    webhook({ orderCode, amount, transactionDateTime, code = '00', signature = 'valid' }) {
      return {
        code,
        desc: 'success',
        success: code === '00',
        data: { orderCode, amount, transactionDateTime },
        signature,
      };
    },
  };
}
