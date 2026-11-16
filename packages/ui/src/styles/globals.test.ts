import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

/**
 * Found by running the web app: without an @source for this package's own components,
 * classes such as bg-card or h-9 were missing from the CSS an app builds, and pages rendered unstyled.
 */
describe('globals.css @source entries', () => {
  it.each(['../components', '../../../../apps/web/src', '../../../../apps/desktop/src'])(
    'scans %s',
    (path) => {
      expect(css).toContain(`@source "${path}"`);
    },
  );
});

const TOKENS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'success',
  'warning',
  'translation',
  'brand',
  'border',
  'input',
  'ring',
  'sidebar',
  'sidebar-foreground',
  'sidebar-accent',
  'duration-fast',
  'duration-base',
  'duration-slow',
  'motion-out',
  'motion-in-out',
  'scrim',
  'elev-sm',
  'elev-md',
  'elev-lg',
];

describe('design tokens', () => {
  const light = css.slice(css.indexOf(':root {'), css.indexOf('\n.dark {'));
  const dark = css.slice(css.indexOf('\n.dark {'));
  it.each(TOKENS)('defines --%s', (token) => {
    expect(light).toContain(`--${token}:`);
  });
  it.each(TOKENS.filter((t) => !/^(duration|motion|elev)/.test(t)))(
    'has a dark value for --%s',
    (token) => {
      expect(dark).toContain(`--${token}:`);
    },
  );
  it('turns animation off under prefers-reduced-motion', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
