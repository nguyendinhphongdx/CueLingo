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
