/**
 * The payment provider gate (AC12). The order, plan and expiry flow only knows this interface, so adding MoMo
 * later means one more adapter and no change to the service. Adapters never log and never keep payer data.
 */

export interface CheckoutRequest {
  orderCode: number;
  /** Whole VND. */
  amount: number;
  /** What the payer sees as the transfer content. */
  description: string;
  returnUrl: string;
  cancelUrl: string;
  /** After this the provider stops accepting payment for the link. */
  expiresAt: Date;
}

export interface Checkout {
  linkId: string;
  /** The VietQR payload the client draws as a QR image. */
  qrCode: string;
  checkoutUrl: string;
}

/** A payment as the service needs it. Nothing about the payer (name, account) is carried. */
export interface PaymentEvent {
  orderCode: number;
  amount: number;
  /** When the money arrived, if the provider says. */
  transactionAt: Date | null;
  reference: string | null;
}

export type WebhookVerdict =
  /** Signature is wrong or the body is unreadable: refuse. */
  | { kind: 'invalid' }
  /** Signature is right but it is not a successful payment: acknowledge, do nothing. */
  | { kind: 'ignored' }
  | { kind: 'paid'; event: PaymentEvent };

export type ProviderStatus = 'pending' | 'paid' | 'cancelled' | 'expired';

export interface ProviderPaymentState {
  status: ProviderStatus;
  /** Money received so far, whole VND. */
  amountPaid: number;
  transactionAt: Date | null;
  reference: string | null;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(request: CheckoutRequest): Promise<Checkout>;
  /** Checks the signature on the raw webhook body, then reads only the fields in {@link PaymentEvent}. */
  verifyWebhook(body: unknown): WebhookVerdict;
  getStatus(orderCode: number): Promise<ProviderPaymentState>;
}

/** The provider failed or refused. The message never contains keys, signatures or payer data. */
export class ProviderError extends Error {}
