/**
 * Where each desktop build is downloaded from. Pure on purpose: no React, so a server module (the web app's
 * config is read by Server Components) can import it. `landing/detect-os.tsx` has a client hook and must not be
 * imported for a value from the server.
 */

/** `null` means it is not offered (yet): no link, no button. */
export type DownloadLinks = { macos: string | null; windows: string | null };

export const NO_DOWNLOADS: DownloadLinks = { macos: null, windows: null };

/** The installer of each system, named the same in every release (release.yml). */
export const DOWNLOAD_FILES = {
  macos: 'CueLingo-macOS-arm64.dmg',
  windows: 'CueLingo-Windows-x64-setup.exe',
} as const;

/**
 * Every system's link from one shared base: the folder the release files are in
 * (`https://github.com/<owner>/<repo>/releases/latest/download`). No base means nothing is offered.
 */
export function downloadLinks(base: string | null): DownloadLinks {
  if (!base) return NO_DOWNLOADS;
  const root = base.replace(/\/+$/, '');
  return { macos: `${root}/${DOWNLOAD_FILES.macos}`, windows: `${root}/${DOWNLOAD_FILES.windows}` };
}
