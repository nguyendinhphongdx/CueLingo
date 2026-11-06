/**
 * How the sandbox runner is embedded (ADR 0019, layer 2). One place, no imports, so the component, the tests and the
 * end-to-end spec all read the same values. Never add `allow-same-origin`, `allow-top-navigation*`, `allow-popups`,
 * `allow-forms`, `allow-modals` or `allow-downloads`: the page would stop being isolated.
 */
export const SANDBOX_FLAGS = 'allow-scripts';
/** Feature policy of the frame: empty turns off camera, microphone, location, clipboard and the rest. */
export const SANDBOX_ALLOW = '';
export const SANDBOX_REFERRER_POLICY = 'no-referrer';
export const RUNNER_PATH = '/runner.html';

/** The runner's URL for an origin such as `https://sandbox.example.com`; null if it is not a plain http(s) origin. */
export function runnerUrl(origin: string | null | undefined): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return `${url.origin}${RUNNER_PATH}`;
  } catch {
    return null;
  }
}
