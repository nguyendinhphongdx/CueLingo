/**
 * Content-Security-Policy of the web app, on every route (ADR 0019, layer 2). Two directives only, on purpose: the page
 * keeps working as before and gains two limits.
 * - `frame-src`: the only frame this route may contain is the sandbox runner; nothing else can be embedded.
 * - `img-src 'self' data:`: no image from another origin, so a reply cannot leak the conversation in an image URL
 *   (the Markdown renderer already draws none; this is the second lock).
 * Self-contained (no imports) because `next.config.ts` loads it before the workspace packages are available.
 */

/** The origin of an http(s) URL, or null. */
export function originOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * The sandbox runner's origin, or null when it is unusable: not an http(s) origin, or the same origin as one of
 * `forbidden` (this app, the API). A runner on the app's own origin would be a page that can read its cookies and
 * storage, which defeats the sandbox. The app's own origin is only known in the browser, so callers pass what they know.
 */
export function sandboxOriginOf(
  candidate: string | null | undefined,
  forbidden: ReadonlyArray<string | null | undefined>,
): string | null {
  const origin = originOf(candidate);
  if (!origin) return null;
  return forbidden.some((other) => originOf(other) === origin) ? null : origin;
}

export function assistantCsp(sandboxOrigin: string | null | undefined): string {
  const origin = originOf(sandboxOrigin);
  return [`frame-src ${origin ?? "'none'"}`, "img-src 'self' data:"].join('; ');
}

/** The build environment (`process.env`); the headers read NEXT_PUBLIC_SANDBOX_ORIGIN and NEXT_PUBLIC_API_URL. */
export type HeaderEnv = Record<string, string | undefined>;

/**
 * Every security header the web app sends, from the build environment. One source for both hosts: `next.config.ts`
 * (`next dev` / `next build`) and `scripts/write-headers.mjs` (the `_headers` file of the static export).
 */
export function securityHeaders(env: HeaderEnv): Array<[name: string, value: string]> {
  const sandboxOrigin = sandboxOriginOf(env.NEXT_PUBLIC_SANDBOX_ORIGIN, [
    env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  ]);
  return [
    ['Content-Security-Policy', assistantCsp(sandboxOrigin)],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ];
}
