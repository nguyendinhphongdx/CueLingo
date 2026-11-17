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

describe('shared components use tokens only', () => {
  it('has no hex colour, dark: variant, text-white or bg-black outside the logo', () => {
    const offenders: string[] = [];
    for (const file of readdirSync(UI)) {
      if (!file.endsWith('.tsx') || /\.test\.|^logo\./.test(file)) continue;
      const text = readFileSync(join(UI, file), 'utf8');
      if (/#[0-9a-fA-F]{6}\b|\bdark:|text-white|bg-black/.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

/** Every file under `dir` whose name matches `pattern` (build output and dependencies skipped). */
function filesMatching(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (['node_modules', 'dist', '.next', 'out', 'target'].includes(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesMatching(path, pattern);
    return pattern.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe('one set of tokens (AC2)', () => {
  const globals = readFileSync(join(ROOT, 'packages/ui/src/styles/globals.css'), 'utf8');
  const rootBlock = globals.slice(globals.indexOf(':root {'), globals.indexOf('\n.dark {'));
  const tokens = [...rootBlock.matchAll(/^\s*(--[\w-]+):/gm)].map((match) => match[1]!);

  it('reads the shared token names from globals.css', () => {
    expect(tokens).toEqual(expect.arrayContaining(['--primary', '--background', '--border']));
  });

  it('keeps web, desktop and site CSS from redefining a shared token', () => {
    const offenders: string[] = [];
    for (const app of ['apps/web/src', 'apps/desktop/src', 'apps/site/src']) {
      for (const file of filesMatching(join(ROOT, app), /\.css$/)) {
        const text = readFileSync(file, 'utf8');
        for (const token of tokens) {
          if (new RegExp(`(^|[;{\\s])${token}\\s*:`).test(text)) {
            offenders.push(`${relative(ROOT, file)} redefines ${token}`);
          }
        }
      }
    }
    expect(offenders, 'Change the token in packages/ui/src/styles/globals.css').toEqual([]);
  });
});

describe('one logo (AC5)', () => {
  /** The mark's own path: any file that carries it, other than Logo and the two image files below, is a copy. */
  const MARK_PATH = 'M167 169.1A64 64 0 1 1 167 86.9';
  /** Image files a browser loads by URL (a favicon cannot be a React component); the mark is the same. */
  const IMAGE_FILES = ['apps/desktop/src/assets/logo.svg', 'apps/site/public/favicon.svg'];

  it('has no hand-copied logo SVG in UI, web, desktop or site sources', () => {
    const offenders: string[] = [];
    const roots = [
      'packages/ui/src',
      'apps/web/src',
      'apps/desktop/src',
      'apps/site/src',
      'apps/site/public',
    ];
    for (const root of roots) {
      for (const file of filesMatching(join(ROOT, root), /\.(tsx?|jsx?|css|svg|html)$/)) {
        const rel = relative(ROOT, file).replaceAll('\\', '/');
        if (rel === 'packages/ui/src/components/logo.tsx' || IMAGE_FILES.includes(rel)) continue;
        if (readFileSync(file, 'utf8').includes(MARK_PATH)) offenders.push(rel);
      }
    }
    expect(offenders, 'Use <Logo /> from @cuelingo/ui').toEqual([]);
  });

  it('keeps the image files identical to the mark in Logo', () => {
    const logo = readFileSync(join(UI, 'logo.tsx'), 'utf8');
    for (const image of IMAGE_FILES) {
      const svg = readFileSync(join(ROOT, image), 'utf8');
      expect(svg, image).toContain(MARK_PATH);
      for (const color of ['#0f172a', '#a5b4fc', '#f59e0b']) {
        expect(svg, `${image} ${color}`).toContain(color);
        expect(logo).toContain(color);
      }
    }
  });
});
