import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');
const light = css.slice(css.indexOf(':root {'), css.indexOf('\n.dark {'));
const dark = css.slice(css.indexOf('\n.dark {'));

const hex = (block: string, name: string): [number, number, number] => {
  const m = new RegExp(`--${name}:\\s*#([0-9a-fA-F]{6})`).exec(block);
  if (!m) throw new Error(`--${name} missing`);
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = ([r, g, b]: number[]) => {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
};
const ratio = (a: number[], b: number[]) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
const mix = (fg: number[], bg: number[], alpha: number) =>
  fg.map((v, i) => v * alpha + bg[i]! * (1 - alpha));

describe.each([
  ['light', light],
  ['dark', dark],
])('contrast (%s)', (_name, block) => {
  const bg = hex(block, 'background');
  it.each([
    ['foreground', 'background'],
    ['muted-foreground', 'background'],
    ['muted-foreground', 'muted'],
    ['primary-foreground', 'primary'],
    ['destructive-foreground', 'destructive'],
    ['card-foreground', 'card'],
  ])('%s on %s is at least 4.5:1', (fg, back) => {
    expect(ratio(hex(block, fg), hex(block, back))).toBeGreaterThanOrEqual(4.5);
  });
  it.each(['input', 'ring'])('--%s border is at least 3:1 on the page', (token) => {
    expect(ratio(hex(block, token), bg)).toBeGreaterThanOrEqual(3);
  });
  it.each(['success', 'warning', 'destructive'])(
    'Badge %s text on its 8%% tint is at least 4.5:1',
    (token) => {
      const text = hex(block, token);
      for (const surface of ['background', 'card', 'muted']) {
        const tint = mix(text, hex(block, surface), 0.08);
        expect(ratio(text, tint), `${token} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
