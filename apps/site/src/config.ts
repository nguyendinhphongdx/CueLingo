import type { DownloadLinks } from '@cuelingo/ui/components/landing/detect-os';
import type { LandingPaths } from '@cuelingo/ui/components/landing/landing-link';

/**
 * Accepts only an https URL; anything else (unset, empty, garbage, http) means "no release yet", so the page
 * shows the locked button instead of a broken link.
 */
export function parseDownloadUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Page links under a deploy base such as `/` or `/<repo>/`. The static site has no sign-in. */
export function sitePaths(base: string): LandingPaths {
  const root = base.endsWith('/') ? base : `${base}/`;
  return { home: root, download: `${root}download/`, login: null };
}

/**
 * The only place the site reads environment variables; all are inlined at build time. A build without
 * `VITE_DOWNLOAD_URL_WINDOWS` has no Windows download: the page tells Windows visitors that Windows is coming.
 */
export const DOWNLOADS: DownloadLinks = {
  macos: parseDownloadUrl(import.meta.env.VITE_DOWNLOAD_URL),
  windows: parseDownloadUrl(import.meta.env.VITE_DOWNLOAD_URL_WINDOWS),
};
export const PATHS = sitePaths(import.meta.env.BASE_URL);
