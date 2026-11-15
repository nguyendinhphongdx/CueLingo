import type { BillingOverviewResponse } from '@cuelingo/shared';

/** The web page that sells plans. Opened in the browser without a token: the web asks to sign in if needed (G7). */
export const UPGRADE_PATH = '/upgrade';

/** Show "Nâng gói" only when payments are on and there is something to buy. */
export function canUpgrade(overview: BillingOverviewResponse | undefined): boolean {
  return Boolean(overview?.enabled && overview.offers.length > 0);
}
