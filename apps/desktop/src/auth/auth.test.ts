import { afterEach, describe, expect, it, vi } from 'vitest';
import { exchangeCode, revokeThisDevice, signInUrl } from './auth-api';
import { currentToken, isDevToken, useAuthStore } from './auth-store';
import { resolveToken } from './token';

afterEach(() => {
  useAuthStore.setState({ status: 'loading', token: null });
  vi.unstubAllEnvs();
});

describe('token source', () => {
  it('reads a plain token or asks a function each time', () => {
    let current = 'a';
    expect(resolveToken('fixed')).toBe('fixed');
    expect(resolveToken(() => current)).toBe('a');
    current = 'b';
    expect(resolveToken(() => current)).toBe('b');
  });
});

describe('current token', () => {
  it('prefers the signed-in device token over the development token', () => {
    vi.stubEnv('VITE_REALTIME_TOKEN', 'dev-123');
    expect(currentToken()).toBe('dev-123');
    expect(isDevToken()).toBe(true);

    useAuthStore.getState().set('signedIn', 'cld_device');
    expect(currentToken()).toBe('cld_device');
    expect(isDevToken()).toBe(false);
  });

  it('is empty when nobody is signed in and there is no development token', () => {
    vi.stubEnv('VITE_REALTIME_TOKEN', '');
    expect(currentToken()).toBe('');
    expect(isDevToken()).toBe(false);
  });
});

describe('auth api', () => {
  it('exchanges the code and returns the device token', async () => {
    const fetcher = vi.fn(async () => Response.json({ token: 'cld_abcdefghijklmnopqrstuvwxyz' }));
    const token = await exchangeCode(
      'one-time-code-1234567890',
      fetcher as unknown as typeof fetch,
    );

    expect(token).toBe('cld_abcdefghijklmnopqrstuvwxyz');
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/v1\/device\/exchange$/);
    expect(JSON.parse(String(init.body))).toMatchObject({ code: 'one-time-code-1234567890' });
  });

  it('fails when the server rejects the code', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 401 }));
    await expect(
      exchangeCode('expired-code-1234567890', fetcher as unknown as typeof fetch),
    ).rejects.toThrow('401');
  });

  it('signs out of the server on a best-effort basis', async () => {
    const failing = vi.fn(async () => {
      throw new Error('offline');
    });
    await expect(
      revokeThisDevice('cld_x', failing as unknown as typeof fetch),
    ).resolves.toBeUndefined();
    const [, init] = failing.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('DELETE');
  });

  it('points the browser at the web login in app mode', () => {
    expect(signInUrl()).toMatch(/\/login\?app=1$/);
  });
});
