import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { sitePaths } from './config';
import { SiteDownload, SiteHome } from './pages';

const RELEASES_REPO = 'acme/cuelingo-releases';
const RELEASE_URL = `https://github.com/${RELEASES_REPO}/releases/latest/download/CueLingo-macOS-arm64.dmg`;
const paths = sitePaths('/cuelingo-releases/');

const home = () => renderToStaticMarkup(<SiteHome paths={paths} />);
const download = (url: string | null = RELEASE_URL) =>
  renderToStaticMarkup(<SiteDownload paths={paths} downloadUrl={url} />);

describe('site pages', () => {
  // AC1: the intro opens without sign-in or API, and leads to the download.
  it('shows the intro and a macOS download action with no sign-in', () => {
    const markup = home();

    expect(markup).toContain('<h1');
    expect(markup).toContain('Nghe họp, hiểu ngay');
    expect(markup).toContain('Tải cho macOS');
    expect(markup).toContain('href="/cuelingo-releases/download/"');
    expect(markup).not.toContain('Đăng nhập');
    expect(markup).not.toContain('/login');
    expect(markup).not.toContain('/sessions');
  });

  // AC2: the button is the latest .dmg of the releases repo, read from configuration.
  it('links the download button to the latest dmg of the releases repo', () => {
    expect(download()).toContain(
      `href="https://github.com/${RELEASES_REPO}/releases/latest/download/CueLingo-macOS-arm64.dmg"`,
    );
  });

  // AC3: both states of the button.
  it('locks the button when no release repo is configured', () => {
    const markup = download(null);

    expect(markup).toContain('Sắp có bản tải');
    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain('Tải cho macOS</a>');
    expect(markup).not.toContain('releases/latest');
  });

  // AC4: requirements, Gatekeeper steps and permissions, in Vietnamese.
  it('states the requirements, the Gatekeeper steps and the permissions in Vietnamese', () => {
    const markup = download();

    expect(markup).toContain('macOS 14.2 trở lên');
    expect(markup).toContain('Apple Silicon');
    expect(markup).toContain('Open Anyway');
    expect(markup).toContain('chưa được Apple công chứng');
    expect(markup).toContain('Microphone');
    expect(markup).toContain('Screen &amp; System Audio Recording');
    expect(markup).toContain('Cài CueLingo trên máy Mac');
  });

  // AC8: the page says the app checks and asks by itself.
  it('says the app checks for updates by itself and asks before installing', () => {
    const markup = download();

    expect(markup).toContain('App tự kiểm tra bản mới');
    expect(markup).toContain('app hỏi bạn trước');
    expect(markup).toContain('chỉ cài khi bạn bấm Cập nhật');
  });

  it('keeps every internal link under the deploy base', () => {
    const links = [...(home() + download()).matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1] ?? '');

    expect(links.length).toBeGreaterThan(0);
    for (const href of links) expect(href.startsWith('/cuelingo-releases/')).toBe(true);
  });
});
