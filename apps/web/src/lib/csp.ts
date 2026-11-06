/**
 * Content-Security-Policy of the assistant route (ADR 0019, layer 2). Two directives only, on purpose: the page
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

export function assistantCsp(sandboxOrigin: string | null | undefined): string {
  const origin = originOf(sandboxOrigin);
  return [`frame-src ${origin ?? "'none'"}`, "img-src 'self' data:"].join('; ');
}
