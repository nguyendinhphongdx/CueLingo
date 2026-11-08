import { serverConfig } from '../server';
import { DeviceExchangeResponseSchema } from '@cuelingo/shared';

const apiBase = () => serverConfig().apiUrl;

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
  const webUrl = serverConfig().webUrl;
  return `${webUrl}/login?app=1`;
}
