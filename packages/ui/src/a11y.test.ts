import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../../..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name.startsWith('.')) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

/** The opening tag starting at `start` (`<` of `<button`), read to its closing `>` while skipping `{...}` and strings. */
function openingTag(text: string, start: number): string {
  let depth = 0;
  let quote = '';
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || (ch === "'" && depth > 0) || (ch === '`' && depth > 0)) quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
}

const NAMED = /aria-label(?:ledby)?=|\{\.\.\.props\}/;

/** Buttons that show an icon and no words, found by reading the JSX. Each entry is `file:line tag`. */
function iconOnlyWithoutName(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const found: string[] = [];
  for (const match of text.matchAll(/<(button|Button)\b/g)) {
    const tag = openingTag(text, match.index!);
    if (NAMED.test(tag)) continue;
    const iconSize = /size=(?:"|\{['"])icon/.test(tag);
    let iconOnly = iconSize;
    if (!iconOnly && !tag.endsWith('/>')) {
      const closing = text.indexOf(`</${match[1]}>`, match.index! + tag.length);
      const children = text.slice(match.index! + tag.length, closing);
      // Words, or an expression that may print words, count as a visible name; a lone <svg>/<Icon /> does not.
      const bare = children.replace(/<[A-Za-z][^>]*\/>|<svg[\s\S]*?<\/svg>/g, '').trim();
      iconOnly = bare === '' && /<svg|<[A-Z]\w*Icon\b|<[A-Z]\w+ [^>]*\/>/.test(children);
    }
    if (iconOnly) {
      const line = text.slice(0, match.index).split('\n').length;
      found.push(`${relative(ROOT, file)}:${line}`);
    }
  }
  return found;
}

describe('icon-only buttons have an accessible name (AC19)', () => {
  it('sees the file sets it scans', () => {
    expect(sources(join(ROOT, 'packages/ui/src/components')).length).toBeGreaterThan(10);
  });

  it('gives every <button>/<Button> with only an icon an aria-label', () => {
    const offenders = ['apps/web/src', 'apps/desktop/src', 'packages/ui/src'].flatMap((dir) =>
      sources(join(ROOT, dir)).flatMap(iconOnlyWithoutName),
    );
    expect(offenders).toEqual([]);
  });

  it('gives every <IconButton> a label', () => {
    const offenders: string[] = [];
    for (const dir of ['apps/web/src', 'apps/desktop/src', 'packages/ui/src']) {
      for (const file of sources(join(ROOT, dir))) {
        const text = readFileSync(file, 'utf8');
        for (const match of text.matchAll(/<IconButton\b/g)) {
          if (!/\blabel=/.test(openingTag(text, match.index!)))
            offenders.push(relative(ROOT, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
