import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  ProviderError,
  type Checkout,
  type CheckoutRequest,
  type PaymentProvider,
  type ProviderPaymentState,
  type ProviderStatus,
  type WebhookVerdict,
} from './provider';

/**
 * PayOS adapter (ADR 0023), written against https://payos.vn/docs. Plain `fetch` (injected for tests) and
 * `node:crypto`; no SDK. Nothing here logs, and errors carry only an HTTP status or a PayOS code.
 */

export interface PayosConfig {
  clientId: string;
  apiKey: string;
  checksumKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

const BASE_URL = 'https://api-merchant.payos.vn';
const TIMEOUT_MS = 10_000;

const hmacHex = (key: string, text: string) => createHmac('sha256', key).update(text).digest('hex');

/** Constant-time comparison of two hex signatures of any length. */
function sameSignature(expected: string, received: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

const NULLISH = new Set<unknown>([null, undefined, 'null', 'undefined']);

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
};

/**
 * The string PayOS signs for a webhook `data` object: keys in alphabetical order, `key=value` joined by `&`,
 * missing values as empty, arrays and objects as JSON with their own keys sorted.
 */
export function webhookSigningString(data: Record<string, unknown>): string {
  return Object.keys(data)
    .sort()
    .filter((key) => data[key] !== undefined)
    .map((key) => {
      const raw = data[key];
      if (NULLISH.has(raw)) return `${key}=`;
      if (typeof raw === 'object') return `${key}=${JSON.stringify(sortKeys(raw))}`;
      return `${key}=${String(raw)}`;
    })
    .join('&');
}

/** The string PayOS signs when a payment link is created. */
export function createSigningString(r: {
  amount: number;
  cancelUrl: string;
  description: string;
  orderCode: number;
  returnUrl: string;
}): string {
  return `amount=${r.amount}&cancelUrl=${r.cancelUrl}&description=${r.description}&orderCode=${r.orderCode}&returnUrl=${r.returnUrl}`;
}

const WebhookBodySchema = z.object({
  code: z.string(),
  signature: z.string(),
  data: z.record(z.string(), z.unknown()),
});

/** Only the fields we use. `counterAccount*` and `virtualAccount*` are never read, kept or logged. */
const WebhookDataSchema = z.object({
  orderCode: z.number().int(),
  amount: z.number().int(),
  reference: z.string().nullish(),
  transactionDateTime: z.string().nullish(),
});

/** PayOS writes transaction times in Vietnam time as `YYYY-MM-DD HH:mm:ss`. */
function parseVietnamTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value.trim().replace(' ', 'T')}+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const STATUS: Record<string, ProviderStatus> = {
  PENDING: 'pending',
  PROCESSING: 'pending',
  UNDERPAID: 'pending',
  PAID: 'paid',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  FAILED: 'cancelled',
};

const CreateResponseSchema = z.object({
  code: z.string(),
  data: z
    .object({ paymentLinkId: z.string(), qrCode: z.string(), checkoutUrl: z.string() })
    .nullish(),
});

const StatusResponseSchema = z.object({
  code: z.string(),
  data: z
    .object({
      status: z.string(),
      amountPaid: z.number().optional(),
      transactions: z
        .array(
          z.object({
            reference: z.string().nullish(),
            transactionDateTime: z.string().nullish(),
          }),
        )
        .optional(),
    })
    .nullish(),
});

export function createPayosProvider(config: PayosConfig): PaymentProvider {
  const request = config.fetch ?? fetch;
  const base = config.baseUrl ?? BASE_URL;

  async function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await request(`${base}${path}`, {
        method,
        headers: {
          'x-client-id': config.clientId,
          'x-api-key': config.apiKey,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new ProviderError('PayOS is unreachable');
    }
    if (!response.ok) throw new ProviderError(`PayOS answered HTTP ${response.status}`);
    try {
      return await response.json();
    } catch {
      throw new ProviderError('PayOS sent an unreadable answer');
    }
  }

  return {
    name: 'payos',

    async createCheckout(r: CheckoutRequest): Promise<Checkout> {
      const signature = hmacHex(config.checksumKey, createSigningString(r));
      const json = await call('POST', '/v2/payment-requests', {
        orderCode: r.orderCode,
        amount: r.amount,
        description: r.description,
        returnUrl: r.returnUrl,
        cancelUrl: r.cancelUrl,
        expiredAt: Math.floor(r.expiresAt.getTime() / 1000),
        signature,
      });
      const parsed = CreateResponseSchema.safeParse(json);
      if (!parsed.success || parsed.data.code !== '00' || !parsed.data.data) {
        throw new ProviderError(
          `PayOS refused the payment link (code ${parsed.success ? parsed.data.code : 'unreadable'})`,
        );
      }
      const { paymentLinkId, qrCode, checkoutUrl } = parsed.data.data;
      return { linkId: paymentLinkId, qrCode, checkoutUrl };
    },

    verifyWebhook(body): WebhookVerdict {
      const parsed = WebhookBodySchema.safeParse(body);
      if (!parsed.success) return { kind: 'invalid' };
      const { code, signature, data } = parsed.data;
      if (!sameSignature(hmacHex(config.checksumKey, webhookSigningString(data)), signature)) {
        return { kind: 'invalid' };
      }
      // Only `data.code` is covered by the signature; the outer `code` can be changed by anyone.
      if (code !== '00' || data.code !== '00') return { kind: 'ignored' };
      const fields = WebhookDataSchema.safeParse(data);
      if (!fields.success) return { kind: 'invalid' };
      return {
        kind: 'paid',
        event: {
          orderCode: fields.data.orderCode,
          amount: fields.data.amount,
          transactionAt: parseVietnamTime(fields.data.transactionDateTime),
          reference: fields.data.reference ?? null,
        },
      };
    },

    async getStatus(orderCode): Promise<ProviderPaymentState> {
      const json = await call('GET', `/v2/payment-requests/${orderCode}`);
      const parsed = StatusResponseSchema.safeParse(json);
      if (!parsed.success || parsed.data.code !== '00' || !parsed.data.data) {
        throw new ProviderError('PayOS did not return the payment status');
      }
      const { status, amountPaid, transactions } = parsed.data.data;
      const last = transactions?.[transactions.length - 1];
      return {
        status: STATUS[status] ?? 'pending',
        amountPaid: amountPaid ?? 0,
        transactionAt: parseVietnamTime(last?.transactionDateTime),
        reference: last?.reference ?? null,
      };
    },
  };
}

/** Registers the webhook URL at PayOS (it also sends a sample transaction to check the URL). */
export async function confirmPayosWebhook(
  config: Omit<PayosConfig, 'checksumKey'>,
  webhookUrl: string,
): Promise<void> {
  const request = config.fetch ?? fetch;
  let response: Response;
  try {
    response = await request(`${config.baseUrl ?? BASE_URL}/confirm-webhook`, {
      method: 'POST',
      headers: {
        'x-client-id': config.clientId,
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ webhookUrl }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ProviderError('PayOS is unreachable');
  }
  if (!response.ok) {
    throw new ProviderError(`PayOS refused the webhook URL (HTTP ${response.status})`);
  }
}
