import { DeviceExchangeResponseSchema } from '@cuelingo/shared';

function apiBase() {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  return url.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:').replace(/\/$/, '');
}

/** Trades the one-time code from the sign-in link for this device's own token. */
export async function exchangeCode(code: string, fetcher: typeof fetch = fetch): Promise<string> {
  const response = await fetcher(`${apiBase()}/v1/device/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, label: 'CueLingo cho macOS' }),
  });
  if (!response.ok) throw new Error(`Sign-in failed with status ${response.status}`);
  return DeviceExchangeResponseSchema.parse(await response.json()).token;
}

/** Asks the server to forget this device. Best effort: signing out locally never waits on it. */
export async function revokeThisDevice(token: string, fetcher: typeof fetch = fetch) {
  await fetcher(`${apiBase()}/v1/device/token`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

export function signInUrl(): string {
  const webUrl = (import.meta.env.VITE_WEB_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${webUrl}/login?app=1`;
}
