import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  detectOs,
  downloadView,
  NO_DOWNLOADS,
  type DownloadLinks,
  type DownloadOs,
} from './detect-os';
import { DownloadPage } from './download-page';
import { LandingView } from './landing-view';

const UA = {
  win10Chrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  win11Edge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  ipadDesktop:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  linux:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  chromeOs:
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
};

describe('detectOs', () => {
  it.each([
    ['Windows 10 Chrome', UA.win10Chrome, undefined, 0, 'windows'],
    ['Windows Edge', UA.win11Edge, 'Win32', 0, 'windows'],
    ['Windows, reduced user agent but a platform hint', 'Mozilla/5.0', 'Windows', 0, 'windows'],
    ['Mac Safari', UA.macSafari, 'MacIntel', 0, 'macos'],
    ['Mac Chrome', UA.macChrome, 'macOS', 0, 'macos'],
    ['Mac with a platform hint only', 'Mozilla/5.0', 'macOS', 0, 'macos'],
    ['iPhone', UA.iphone, 'iPhone', 5, 'other'],
    ['iPad asking for the desktop site', UA.ipadDesktop, 'MacIntel', 5, 'other'],
    ['Android', UA.android, 'Linux armv8l', 5, 'other'],
    ['Linux', UA.linux, 'Linux x86_64', 0, 'other'],
    ['ChromeOS', UA.chromeOs, 'Linux x86_64', 0, 'other'],
    ['nothing known', '', null, 0, 'other'],
  ] as const)('%s is %s', (_name, ua, hint, touch, expected) => {
    expect(detectOs(ua, hint, touch)).toBe(expected);
  });
});

describe('downloadView', () => {
  const both: DownloadLinks = { macos: 'https://x/mac.dmg', windows: 'https://x/win.exe' };
  const macOnly: DownloadLinks = { macos: 'https://x/mac.dmg', windows: null };

  it('keeps the macOS page for everyone while Windows is not offered, except a Windows visitor', () => {
    for (const os of [null, 'macos', 'other'] as const) {
      expect(downloadView(os, macOnly)).toBe('macos');
      expect(downloadView(os, NO_DOWNLOADS)).toBe('macos');
    }
    expect(downloadView('windows', macOnly)).toBe('windows-soon');
    expect(downloadView('windows', NO_DOWNLOADS)).toBe('windows-soon');
  });

  it('leads with the visitor system once Windows is offered, and shows both while it is unknown', () => {
    expect(downloadView('windows', both)).toBe('windows');
    expect(downloadView('macos', both)).toBe('macos');
    expect(downloadView(null, both)).toBe('both');
    expect(downloadView('other', both)).toBe('both');
  });
});

const MAC = 'https://example.com/CueLingo-macOS-arm64.dmg';
const WIN = 'https://example.com/CueLingo-Windows-x64-setup.exe';
const page = (os: DownloadOs | null, downloads: DownloadLinks) =>
  renderToStaticMarkup(<DownloadPage downloads={downloads} os={os} />);

describe('download page by system', () => {
  it('renders the first (server) pass as the macOS page, with no Windows button, while Windows is gated', () => {
    const markup = renderToStaticMarkup(<DownloadPage downloads={{ macos: MAC, windows: null }} />);

    expect(markup).toContain('Cài CueLingo trên máy Mac');
    expect(markup).toContain(`href="${MAC}"`);
    expect(markup).not.toContain('Windows');
  });

  it('tells a Windows visitor that Windows is coming, with no Mac button and no download link', () => {
    const markup = page('windows', { macos: MAC, windows: null });

    expect(markup).toContain('Windows sắp có');
    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain('Tải cho macOS');
    expect(markup).not.toContain(MAC);
    expect(markup).not.toContain('.exe');
    expect(markup).not.toContain('Open Anyway');
  });

  it('puts the Windows button first for a Windows visitor, with the Mac link after it and SmartScreen steps', () => {
    const markup = page('windows', { macos: MAC, windows: WIN });

    expect(markup).toContain('Cài CueLingo trên Windows');
    expect(markup.indexOf(WIN)).toBeGreaterThan(-1);
    expect(markup.indexOf(WIN)).toBeLessThan(markup.indexOf(MAC));
    expect(markup).toContain('Windows 10 (22H2) hoặc Windows 11');
    expect(markup).toContain('Windows protected your PC');
    expect(markup).toContain('Run anyway');
    expect(markup).not.toContain('Open Anyway');
  });

  it('puts the Mac button first for a Mac visitor, with the Windows link after it', () => {
    const markup = page('macos', { macos: MAC, windows: WIN });

    expect(markup).toContain('Cài CueLingo trên máy Mac');
    expect(markup.indexOf(MAC)).toBeLessThan(markup.indexOf(WIN));
    expect(markup).toContain('Open Anyway');
    expect(markup).not.toContain('Windows protected your PC');
  });

  it('shows both builds and both requirement blocks while the system is not known', () => {
    const markup = page(null, { macos: MAC, windows: WIN });

    expect(markup).toContain('Tải cho macOS');
    expect(markup).toContain('Tải cho Windows');
    expect(markup).toContain('Máy Mac cần gì?');
    expect(markup).toContain('Máy Windows cần gì?');
  });

  it('keeps a locked Mac button, never a dead link, when no Mac release exists yet', () => {
    const markup = page('windows', { macos: null, windows: WIN });

    expect(markup).toContain(`href="${WIN}"`);
    expect(markup).not.toContain('Dùng máy Mac');
    expect(page('macos', NO_DOWNLOADS)).toContain('Sắp có bản tải');
  });
});

describe('landing by system', () => {
  const landing = (os: DownloadOs | null, downloads: DownloadLinks) =>
    renderToStaticMarkup(<LandingView downloads={downloads} os={os} />);

  it('does not mention Windows while no Windows download is offered', () => {
    const markup = landing('macos', { macos: MAC, windows: null });

    expect(markup).toContain('Tải cho macOS');
    expect(markup).not.toContain('Windows');
    expect(markup).not.toContain('Máy Mac của bạn');
  });

  it('says Windows is coming to a Windows visitor, and names the main action after their system', () => {
    expect(landing('windows', { macos: MAC, windows: null })).toContain('Windows sắp có');
    const withWindows = landing('windows', { macos: MAC, windows: WIN });
    expect(withWindows).toContain('Tải cho Windows');
    expect(withWindows).toContain('Vì sao Windows cảnh báo khi cài?');
    expect(withWindows).toContain('CueLingo cho macOS và Windows');
  });
});
