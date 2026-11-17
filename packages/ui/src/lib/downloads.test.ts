import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { downloadLinks, NO_DOWNLOADS } from './downloads';

describe('downloadLinks', () => {
  const base = 'https://github.com/owner/repo/releases/latest/download';

  it('gives every system its installer from the one base', () => {
    expect(downloadLinks(base)).toEqual({
      macos: `${base}/CueLingo-macOS-arm64.dmg`,
      windows: `${base}/CueLingo-Windows-x64-setup.exe`,
    });
  });

  it('does not double the slash when the base ends with one', () => {
    expect(downloadLinks(`${base}/`)).toEqual(downloadLinks(base));
    expect(downloadLinks(`${base}//`).macos).toBe(`${base}/CueLingo-macOS-arm64.dmg`);
  });

  it('offers nothing without a base', () => {
    expect(downloadLinks(null)).toEqual(NO_DOWNLOADS);
    expect(downloadLinks('')).toEqual(NO_DOWNLOADS);
  });
});

describe('the module stays importable from a server', () => {
  // The web app's config imports it, and Server Components import the config: a React import here breaks
  // `next build` ("depends on useSyncExternalStore into a React Server Component").
  it('imports nothing from React or from a component', () => {
    const source = readFileSync(new URL('./downloads.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from\s+['"]react/);
    expect(source).not.toMatch(/from\s+['"]\.\.?\/components/);
  });
});
