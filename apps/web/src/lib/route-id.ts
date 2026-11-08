/**
 * Dynamic routes (`/sessions/[id]`, `/assistant/[[...id]]`) are exported as ONE placeholder page each, because a static
 * site cannot know the ids. The host rewrites every `/sessions/<id>` to the placeholder page (public/_redirects), so the
 * real id is only in the address bar: it is read here, in the browser, never from the server `params`.
 */
export const PLACEHOLDER_ID = '_';

/** The path segments after `base` ("/sessions"), with the placeholder dropped. `/sessions/abc` -> ['abc']. */
export function idsAfter(pathname: string | null, base: string): string[] {
  if (!pathname) return [];
  const prefix = `${base}/`;
  if (!pathname.startsWith(prefix)) return [];
  return pathname
    .slice(prefix.length)
    .split('/')
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    })
    .filter((part) => part !== PLACEHOLDER_ID);
}
