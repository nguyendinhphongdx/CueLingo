import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const globals = readFileSync(join(__dirname, '../../styles/globals.css'), 'utf8');
const css = readFileSync(join(__dirname, 'landing.module.css'), 'utf8');

type Rgb = [number, number, number];

/** Token values of one mode: `:root` is light, `.dark` is dark (the dark block overrides the light one). */
function tokens(mode: 'light' | 'dark'): Record<string, string> {
  const light = globals.slice(globals.indexOf(':root {'), globals.indexOf('\n.dark {'));
  const dark = globals.slice(globals.indexOf('\n.dark {'), globals.indexOf('@theme inline'));
  const read = (block: string) =>
    Object.fromEntries(
      [...block.matchAll(/^\s*(--[\w-]+):\s*(#[0-9a-fA-F]{6})/gm)].map((m) => [m[1]!, m[2]!]),
    );
  return mode === 'light' ? read(light) : { ...read(light), ...read(dark) };
}

const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgb) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const ratio = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
const mix = (top: Rgb, bottom: Rgb, share: number): Rgb =>
  top.map((v, i) => v * share + bottom[i]! * (1 - share)) as Rgb;

/** Text pairs the landing and download pages draw: [text token, ground token, where]. */
const text: Array<[string, string, string]> = [
  ['--foreground', '--background', 'body copy'],
  ['--muted-foreground', '--background', 'lead and header links'],
  ['--foreground', '--muted', 'FAQ and step cards'],
  ['--muted-foreground', '--muted', 'stage and FAQ copy'],
  ['--muted-foreground', '--accent', 'locked download button'],
  ['--primary-foreground', '--primary', 'buttons, privacy band, accent tiles'],
  ['--background', '--foreground', 'header action, footer'],
  ['--background', '--warning', 'amber tile, flow step and mark letters'],
];

describe('landing colours use the design tokens', () => {
  it('declares no colour of its own outside the dark product mock', () => {
    const outsideMock = css
      .split('\n')
      .filter((line) => !/--w-|#[0-9a-fA-F]{3,8}\b|rgb\(/.test(line));
    expect(outsideMock.join('\n')).not.toMatch(/--(ground|ink|soft|step|amber|on-accent)\b/);
    expect(css).not.toMatch(/prefers-color-scheme|:global\(\.(dark|light)\)/);
  });

  for (const mode of ['light', 'dark'] as const) {
    describe(mode, () => {
      const t = tokens(mode);
      for (const [fg, bg, where] of text) {
        it(`${fg} on ${bg} (${where}) is at least 4.5:1`, () => {
          expect(ratio(rgb(t[fg]!), rgb(t[bg]!))).toBeGreaterThanOrEqual(4.5);
        });
      }

      it('footer note (background at 70% over foreground) is at least 4.5:1', () => {
        const note = mix(rgb(t['--background']!), rgb(t['--foreground']!), 0.7);
        expect(ratio(note, rgb(t['--foreground']!))).toBeGreaterThanOrEqual(4.5);
      });

      it('focus ring and slider thumb stand out from the ground at 3:1', () => {
        expect(ratio(rgb(t['--ring']!), rgb(t['--background']!))).toBeGreaterThanOrEqual(3);
        expect(ratio(rgb(t['--primary']!), rgb(t['--muted']!))).toBeGreaterThanOrEqual(3);
      });
    });
  }
});
