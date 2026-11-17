import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEGACY_REDIRECTS } from './legacy-redirects';

describe('legacy Ôn tập redirects (AC11)', () => {
  it('sends /phrases and /progress to their tab of /review', () => {
    expect(LEGACY_REDIRECTS).toEqual([
      { source: '/phrases', destination: '/review?tab=phrases' },
      { source: '/progress', destination: '/review?tab=progress' },
    ]);
  });

  it('is the same list as the 301 rules of the static build', () => {
    const file = readFileSync(join(__dirname, '..', '..', 'public', '_redirects'), 'utf8');
    for (const { source, destination } of LEGACY_REDIRECTS) {
      expect(file).toContain(`${source}  ${destination}  301`);
    }
  });
});
