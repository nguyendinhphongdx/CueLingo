import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  confirmPayosWebhook,
  createPayosProvider,
  createSigningString,
  webhookSigningString,
} from './payos';
import { ProviderError } from './provider';

const KEY = 'test-checksum-key';

/** Computed outside this code base (node:crypto in a one-off script) from the string in the comment. */
const WEBHOOK_DATA = {
  orderCode: 1000001,
  amount: 99000,
  description: 'CL1000001',
  accountNumber: '12345678',
  reference: 'FT123',
  transactionDateTime: '2026-11-15 10:00:00',
  currency: 'VND',
  paymentLinkId: 'abc123',
  code: '00',
  desc: 'Thành công',
  counterAccountBankId: '',
  counterAccountBankName: null,
  counterAccountName: null,
  counterAccountNumber: null,
  virtualAccountName: '',
  virtualAccountNumber: '',
};
// accountNumber=12345678&amount=99000&code=00&counterAccountBankId=&counterAccountBankName=&counterAccountName=&counterAccountNumber=&currency=VND&desc=Thành công&description=CL1000001&orderCode=1000001&paymentLinkId=abc123&reference=FT123&transactionDateTime=2026-11-15 10:00:00&virtualAccountName=&virtualAccountNumber=
const WEBHOOK_SIGNATURE = '2f928adf1a7bb80870519ef9bdd3165de3b12f4610a7eae55b1e34a5ece6e07a';
const CREATE_SIGNATURE = '549df50de99f06f93f9681213db79a2fcf643fe8181ef32a61c60d5061226f01';

const provider = (fetchImpl?: typeof fetch) =>
  createPayosProvider({ clientId: 'cid', apiKey: 'akey', checksumKey: KEY, fetch: fetchImpl });

const reply = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('signature vectors', () => {
  it('builds the signing string of a webhook: sorted keys, nulls empty', () => {
    expect(webhookSigningString(WEBHOOK_DATA)).toBe(
      'accountNumber=12345678&amount=99000&code=00&counterAccountBankId=&counterAccountBankName=&counterAccountName=&counterAccountNumber=&currency=VND&desc=Thành công&description=CL1000001&orderCode=1000001&paymentLinkId=abc123&reference=FT123&transactionDateTime=2026-11-15 10:00:00&virtualAccountName=&virtualAccountNumber=',
    );
  });

  it('turns the strings "null" and "undefined" into empty values, and arrays into sorted JSON', () => {
    expect(
      webhookSigningString({ b: 'null', a: 'undefined', c: [{ z: 1, y: 2 }], d: undefined }),
    ).toBe('a=&b=&c=[{"y":2,"z":1}]');
  });

  it('builds the signing string of a payment link', () => {
    expect(
      createSigningString({
        amount: 99000,
        cancelUrl: 'https://web.example/checkout?order=o&cancelled=1',
        description: 'CL1000001',
        orderCode: 1000001,
        returnUrl: 'https://web.example/checkout?order=o',
      }),
    ).toBe(
      'amount=99000&cancelUrl=https://web.example/checkout?order=o&cancelled=1&description=CL1000001&orderCode=1000001&returnUrl=https://web.example/checkout?order=o',
    );
  });

  it('accepts the fixed webhook vector and drops everything about the payer', () => {
    const verdict = provider().verifyWebhook({
      code: '00',
      desc: 'success',
      success: true,
      data: WEBHOOK_DATA,
      signature: WEBHOOK_SIGNATURE,
    });
    expect(verdict).toEqual({
      kind: 'paid',
      event: {
        orderCode: 1000001,
        amount: 99000,
        transactionAt: new Date('2026-11-15T03:00:00.000Z'),
        reference: 'FT123',
      },
    });
    expect(JSON.stringify(verdict)).not.toMatch(/12345678|counterAccount|virtualAccount/);
  });

  it('refuses a wrong signature, a changed amount, a missing signature and an unreadable body', () => {
    const p = provider();
    const body = { code: '00', data: WEBHOOK_DATA, signature: WEBHOOK_SIGNATURE };
    expect(p.verifyWebhook({ ...body, signature: WEBHOOK_SIGNATURE.replace(/^./, '0') })).toEqual({
      kind: 'invalid',
    });
    expect(p.verifyWebhook({ ...body, data: { ...WEBHOOK_DATA, amount: 1 } })).toEqual({
      kind: 'invalid',
    });
    expect(p.verifyWebhook({ ...body, signature: '' })).toEqual({ kind: 'invalid' });
    expect(p.verifyWebhook({ ...body, signature: 'short' })).toEqual({ kind: 'invalid' });
    expect(p.verifyWebhook(null)).toEqual({ kind: 'invalid' });
    expect(p.verifyWebhook({ code: '00' })).toEqual({ kind: 'invalid' });
    // A signature from another key is refused.
    const other = createPayosProvider({ clientId: 'c', apiKey: 'a', checksumKey: 'other' });
    expect(other.verifyWebhook(body)).toEqual({ kind: 'invalid' });
  });

  it('acknowledges a correctly signed webhook that is not a success', () => {
    // Re-sign the data with code "01" using the same algorithm via the exported string builder.
    const data = { ...WEBHOOK_DATA, code: '01' };
    const signature = signWith(KEY, webhookSigningString(data));
    expect(provider().verifyWebhook({ code: '01', data, signature })).toEqual({ kind: 'ignored' });
  });
});

function signWith(key: string, text: string) {
  return createHmac('sha256', key).update(text).digest('hex');
}

describe('createCheckout', () => {
  const request = {
    orderCode: 1000001,
    amount: 99000,
    description: 'CL1000001',
    returnUrl: 'https://web.example/checkout?order=o',
    cancelUrl: 'https://web.example/checkout?order=o&cancelled=1',
    expiresAt: new Date('2026-11-15T10:15:00Z'),
  };

  it('posts a signed body with the key headers and reads the link', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      reply({
        code: '00',
        desc: 'success',
        data: {
          paymentLinkId: 'link-1',
          qrCode: '000201...',
          checkoutUrl: 'https://pay.payos.vn/web/link-1',
          accountNumber: '9',
          accountName: 'X',
        },
        signature: 'ignored',
      }),
    );
    const checkout = await provider(fetchMock).createCheckout(request);
    expect(checkout).toEqual({
      linkId: 'link-1',
      qrCode: '000201...',
      checkoutUrl: 'https://pay.payos.vn/web/link-1',
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api-merchant.payos.vn/v2/payment-requests');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'x-client-id': 'cid', 'x-api-key': 'akey' });
    expect(JSON.parse(init?.body as string)).toEqual({
      orderCode: 1000001,
      amount: 99000,
      description: 'CL1000001',
      returnUrl: request.returnUrl,
      cancelUrl: request.cancelUrl,
      expiredAt: Math.floor(request.expiresAt.getTime() / 1000),
      signature: CREATE_SIGNATURE,
    });
  });

  it('turns a PayOS refusal or an outage into a ProviderError without leaking the keys', async () => {
    const refused = provider(() => reply({ code: '231', desc: 'Order exists', data: null }));
    await expect(refused.createCheckout(request)).rejects.toThrow(ProviderError);
    const down = provider(() => reply({}, 500));
    await expect(down.createCheckout(request)).rejects.toThrow(/HTTP 500/);
    const offline = provider(() => Promise.reject(new Error('connect akey ECONNREFUSED')));
    const error = await offline.createCheckout(request).catch((e: Error) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as Error).message).not.toMatch(/akey|ECONN/);
  });
});

describe('getStatus', () => {
  it('maps PayOS statuses and reads the last transaction', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      reply({
        code: '00',
        data: {
          status: 'PAID',
          amountPaid: 99000,
          transactions: [
            { reference: 'FT9', transactionDateTime: '2026-11-15 10:01:02', accountNumber: '1' },
          ],
        },
      }),
    );
    expect(await provider(fetchMock).getStatus(1000001)).toEqual({
      status: 'paid',
      amountPaid: 99000,
      transactionAt: new Date('2026-11-15T03:01:02.000Z'),
      reference: 'FT9',
    });
    expect(fetchMock.mock.calls[0]![0]).toBe(
      'https://api-merchant.payos.vn/v2/payment-requests/1000001',
    );
    expect(fetchMock.mock.calls[0]![1]?.method).toBe('GET');
    for (const [raw, status] of [
      ['PENDING', 'pending'],
      ['CANCELLED', 'cancelled'],
      ['EXPIRED', 'expired'],
    ] as const) {
      const p = provider(() => reply({ code: '00', data: { status: raw } }));
      expect((await p.getStatus(1)).status).toBe(status);
    }
  });

  it('fails clearly when PayOS does not answer', async () => {
    await expect(provider(() => reply({ code: '101', data: null })).getStatus(1)).rejects.toThrow(
      ProviderError,
    );
  });
});

describe('confirmPayosWebhook', () => {
  it('posts the URL with the key headers', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => reply({ code: '00', desc: 'success' }));
    await confirmPayosWebhook(
      { clientId: 'cid', apiKey: 'akey', fetch: fetchMock },
      'https://api.example/v1/billing/webhook/payos',
    );
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api-merchant.payos.vn/confirm-webhook');
    expect(JSON.parse(init?.body as string)).toEqual({
      webhookUrl: 'https://api.example/v1/billing/webhook/payos',
    });
    expect(init?.headers).toMatchObject({ 'x-client-id': 'cid', 'x-api-key': 'akey' });
  });

  it('throws a ProviderError when PayOS refuses', async () => {
    await expect(
      confirmPayosWebhook(
        { clientId: 'c', apiKey: 'k', fetch: () => reply({}, 400) },
        'https://x.example',
      ),
    ).rejects.toThrow(ProviderError);
  });
});
