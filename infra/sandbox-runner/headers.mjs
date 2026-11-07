/**
 * Response headers of the sandbox runner (ADR 0019, layer 2). The page is served on its own origin and embedded by
 * the web app with `sandbox="allow-scripts"` (never `allow-same-origin`). These headers are the real boundary
 * for the code the assistant wrote: the page cannot open a connection, load a resource or submit a form, whatever
 * the code tries. `_headers` repeats them for static hosts; `runner.test.mjs` keeps the two in step.
 */

/** Everything is denied, then only what an inline lesson page needs is allowed back. */
export const CSP_DIRECTIVES = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'media-src data: blob:',
  'font-src data:',
  "connect-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "prefetch-src 'none'",
  "manifest-src 'none'",
  "object-src 'none'",
  "worker-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
];

/**
 * @param {{ frameAncestors?: string }} [options] origins allowed to embed the runner, space separated; empty means none
 * @returns {Record<string, string>}
 */
export function runnerHeaders(options = {}) {
  const ancestors = options.frameAncestors?.trim() || "'none'";
  return {
    'Content-Security-Policy': [...CSP_DIRECTIVES, `frame-ancestors ${ancestors}`].join('; '),
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
    // CSP does not cover DNS prefetch: this header switches it off for the whole document.
    'X-DNS-Prefetch-Control': 'off',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=(), clipboard-write=(), fullscreen=()',
    // The page changes with deploys and holds no user data: revalidate instead of caching blindly.
    'Cache-Control': 'no-cache',
  };
}
