import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../../..');
const UI = join(ROOT, 'packages/ui/src/components');

/** Every component exported by @cuelingo/ui. A client may use it; it may not draw its own. */
const shared = readdirSync(UI)
  .filter((file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx'))
  .flatMap((file) =>
    [...readFileSync(join(UI, file), 'utf8').matchAll(/export function ([A-Z]\w+)/g)].map(
      (match) => match[1]!,
    ),
  );

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name.startsWith('.')) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe('shared UI rule', () => {
  it('knows which components are shared', () => {
    expect(shared).toEqual(
      expect.arrayContaining(['Avatar', 'AccountChip', 'PersonRow', 'IconButton']),
    );
  });

  it('keeps clients from re-defining a component that @cuelingo/ui already has', () => {
    const offenders: string[] = [];
    for (const app of ['apps/web/src', 'apps/desktop/src']) {
      for (const file of sources(join(ROOT, app))) {
        const text = readFileSync(file, 'utf8');
        for (const name of shared) {
          const defined = new RegExp(`(?:function|const)\\s+${name}\\b\\s*(?:\\(|=)`).test(text);
          if (defined) offenders.push(`${relative(ROOT, file)} defines ${name}`);
        }
      }
    }
    expect(offenders, 'Use the component from @cuelingo/ui instead of defining another').toEqual(
      [],
    );
  });
});
