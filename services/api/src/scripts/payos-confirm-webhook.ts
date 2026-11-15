import { loadConfig } from '../config';
import { confirmPayosWebhook } from '../modules/billing/providers/payos';

/**
 * Registers the webhook URL at PayOS. PayOS posts a sample transaction to it, which our webhook acknowledges.
 * `pnpm --filter @cuelingo/api billing:confirm-webhook [url]`; the default is `<BETTER_AUTH_URL>/v1/billing/webhook/payos`.
 * Run it again whenever the public URL of the API changes. Prints the URL only, never the keys.
 */
const config = loadConfig();
if (!config.PAYOS_CLIENT_ID || !config.PAYOS_API_KEY) {
  console.error('Set PAYOS_CLIENT_ID, PAYOS_API_KEY and PAYOS_CHECKSUM_KEY first.');
  process.exit(1);
}

const url =
  process.argv[2] ?? `${config.BETTER_AUTH_URL.replace(/\/$/, '')}/v1/billing/webhook/payos`;
if (!url.startsWith('https://')) {
  console.error(`PayOS needs a public https URL, got: ${url}`);
  process.exit(1);
}

try {
  await confirmPayosWebhook(
    { clientId: config.PAYOS_CLIENT_ID, apiKey: config.PAYOS_API_KEY },
    url,
  );
  process.stdout.write(`Webhook registered: ${url}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'PayOS refused the webhook URL');
  process.exit(1);
}
