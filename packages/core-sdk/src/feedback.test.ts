import { describe, expect, it, vi } from 'vitest';
import { createClient } from './index';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('feedback client', () => {
  it('posts the feedback and parses the receipt', async () => {
    const fetch = vi.fn().mockResolvedValue(
      json(201, {
        id: '6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f',
        createdAt: '2026-11-08T00:00:00.000Z',
      }),
    );
    const client = createClient({ baseUrl: 'http://api', getToken: () => 't0k', fetch });
    const input = {
      kind: 'idea',
      message: 'Thêm phím tắt',
      client: 'web',
      appVersion: '0.1.1',
      os: 'macOS 15',
    } as const;

    const receipt = await client.feedback.send(input);

    expect(receipt.id).toBe('6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f');
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('http://api/v1/feedback');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(input);
  });
});
