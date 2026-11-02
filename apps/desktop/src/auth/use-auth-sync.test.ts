import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authTokenGet: vi.fn(async () => 'cld_token'),
  onAuthChanged: vi.fn(async () => () => undefined),
}));
vi.mock('../lib/native', () => ({ native: mocks }));

import { currentToken, useAuthStore } from './auth-store';

afterEach(() => vi.unstubAllEnvs());

describe('signing a secondary window in', () => {
  it('the overlay has no token until it reads the Keychain, then every call uses it', async () => {
    vi.stubEnv('VITE_REALTIME_TOKEN', '');
    useAuthStore.setState({ status: 'loading', token: null });
    expect(currentToken()).toBe('');

    // What `useAuthSync` does on mount and on every `auth-changed` event.
    const token = await mocks.authTokenGet();
    useAuthStore.getState().set(token ? 'signedIn' : 'signedOut', token);

    expect(currentToken()).toBe('cld_token');
    useAuthStore.setState({ status: 'loading', token: null });
  });
});
