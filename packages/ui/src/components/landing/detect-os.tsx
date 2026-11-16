import { useSyncExternalStore } from 'react';

/** The system a visitor browses from, as far as the download page cares. */
export type DownloadOs = 'macos' | 'windows' | 'other';

/** Where each build is downloaded from. `null` means it is not offered (yet): no link, no button. */
export type DownloadLinks = { macos: string | null; windows: string | null };

export const NO_DOWNLOADS: DownloadLinks = { macos: null, windows: null };

/**
 * Guesses the system from the browser's own words. `platformHint` is `navigator.userAgentData.platform` or
 * `navigator.platform`; `touchPoints` is `navigator.maxTouchPoints`, the only way to tell an iPad that asks for
 * the desktop site (it says it is a Mac) from a real Mac. Phones, tablets, ChromeOS and Linux are `other`.
 */
export function detectOs(
  userAgent: string,
  platformHint?: string | null,
  touchPoints = 0,
): DownloadOs {
  const hint = platformHint ?? '';
  if (/iPhone|iPad|iPod|Android|CrOS/i.test(userAgent)) return 'other';
  if (/Windows/i.test(userAgent) || /^win/i.test(hint)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(userAgent) || /^mac/i.test(hint)) {
    return touchPoints > 1 ? 'other' : 'macos';
  }
  return 'other';
}

/** What the page shows: one system's build, both builds side by side, or the honest "Windows is coming". */
export type DownloadView = 'macos' | 'windows' | 'both' | 'windows-soon';

/**
 * Which view a visitor gets. `os` is null until the browser has been asked (the first render, also on the
 * server): then, and for a system that is neither, both builds are shown when Windows is offered, and the
 * macOS page as it has always been when it is not. A Windows visitor never gets a Mac button: with no Windows
 * link they are told that Windows is coming.
 */
export function downloadView(os: DownloadOs | null, links: DownloadLinks): DownloadView {
  const hasWindows = links.windows !== null;
  if (os === 'windows') return hasWindows ? 'windows' : 'windows-soon';
  if (os === 'macos' || !hasWindows) return 'macos';
  return 'both';
}

const subscribeNever = () => () => {};

function readOs(): DownloadOs {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return detectOs(nav.userAgent, nav.userAgentData?.platform ?? nav.platform, nav.maxTouchPoints);
}

/**
 * The visitor's system once the page is in a browser; `null` on the server and in the first client render, so
 * the markup the server sent matches what hydration draws.
 */
export function useDetectedOs(): DownloadOs | null {
  return useSyncExternalStore(subscribeNever, readOs, () => null);
}
