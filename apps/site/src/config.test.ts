import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { parseDownloadUrl, sitePaths } from './config';
import { SiteDownload } from './pages';

const RELEASE_URL =
  'https://github.com/acme/cuelingo-releases/releases/latest/download/CueLingo-macOS-arm64.dmg';

describe('parseDownloadUrl', () => {
  it('keeps a valid https release URL', () => {
    expect(parseDownloadUrl(RELEASE_URL)).toBe(RELEASE_URL);
    expect(parseDownloadUrl(`  ${RELEASE_URL}  `)).toBe(RELEASE_URL);
  });

  it('treats unset, empty, malformed and non-https values as "no release yet"', () => {
    expect(parseDownloadUrl(undefined)).toBeNull();
    expect(parseDownloadUrl('')).toBeNull();
    expect(parseDownloadUrl('   ')).toBeNull();
    expect(parseDownloadUrl('not a url')).toBeNull();
    expect(parseDownloadUrl('http://example.com/a.dmg')).toBeNull();
    expect(parseDownloadUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('sitePaths', () => {
  it('builds page links under the root and under a repo base, without sign-in', () => {
    expect(sitePaths('/')).toEqual({ home: '/', download: '/download/', login: null });
    expect(sitePaths('/cuelingo-releases/')).toEqual({
      home: '/cuelingo-releases/',
      download: '/cuelingo-releases/download/',
      login: null,
    });
    expect(sitePaths('/repo').download).toBe('/repo/download/');
  });
});

describe('SiteDownload button', () => {
  it('points at the configured release when there is one', () => {
    const markup = renderToStaticMarkup(
      createElement(SiteDownload, {
        paths: sitePaths('/'),
        downloads: { macos: RELEASE_URL, windows: null },
      }),
    );

    expect(markup).toContain(`href="${RELEASE_URL}"`);
    expect(markup).toContain('Tải cho macOS');
    expect(markup).not.toContain('Sắp có bản tải');
  });

  it('is a locked button, not a dead link, when no release is configured', () => {
    const markup = renderToStaticMarkup(
      createElement(SiteDownload, {
        paths: sitePaths('/'),
        downloads: { macos: null, windows: null },
      }),
    );

    expect(markup).toContain('Sắp có bản tải');
    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain('releases/latest');
  });
});

describe('Windows download gate', () => {
  it('offers no Windows download unless VITE_DOWNLOAD_URL_WINDOWS is set to an https address', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_DOWNLOAD_URL', RELEASE_URL);
    vi.stubEnv('VITE_DOWNLOAD_URL_WINDOWS', '');
    expect((await import('./config')).DOWNLOADS).toEqual({ macos: RELEASE_URL, windows: null });

    vi.resetModules();
    vi.stubEnv('VITE_DOWNLOAD_URL_WINDOWS', 'http://example.com/setup.exe');
    expect((await import('./config')).DOWNLOADS.windows).toBeNull();

    vi.resetModules();
    const windows = 'https://example.com/CueLingo-Windows-x64-setup.exe';
    vi.stubEnv('VITE_DOWNLOAD_URL_WINDOWS', windows);
    expect((await import('./config')).DOWNLOADS.windows).toBe(windows);
    vi.unstubAllEnvs();
  });
});
