import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { barHeight, LEVEL_METER_BARS, LEVEL_METER_MIN, LevelMeter } from './level-meter';

describe('LevelMeter', () => {
  it('is a labelled meter with a fixed number of bars', () => {
    const markup = renderToStaticMarkup(<LevelMeter levels={[0.1, 0.5]} label="Micro" />);
    expect(markup).toContain('role="meter"');
    expect(markup).toContain('aria-label="Micro"');
    expect(markup.match(/data-bar/g)).toHaveLength(LEVEL_METER_BARS);
  });

  it('draws the newest level on the right and keeps a minimum height', () => {
    const markup = renderToStaticMarkup(<LevelMeter levels={[1]} label="Micro" />);
    const heights = [...markup.matchAll(/data-bar="" [^>]*style="height:(\d+)%"/g)].map((m) =>
      Number(m[1]),
    );
    expect(heights.at(-1)).toBe(100);
    expect(heights[0]).toBe(Math.round(LEVEL_METER_MIN * 100));
    expect(Math.min(...heights)).toBeGreaterThan(0);
  });

  it('only keeps the latest bars when given more levels', () => {
    const levels = Array.from({ length: 60 }, (_, i) => (i === 59 ? 1 : 0));
    const markup = renderToStaticMarkup(<LevelMeter levels={levels} label="x" />);
    expect(markup.match(/data-bar/g)).toHaveLength(LEVEL_METER_BARS);
  });

  it('rests at the minimum and dims when inactive', () => {
    const markup = renderToStaticMarkup(<LevelMeter levels={[1]} label="x" active={false} />);
    expect(markup).toContain('data-active="false"');
    expect(markup).toContain('opacity-40');
    expect(markup).not.toContain('height:100%');
  });

  it('has a single simple bar for reduced motion', () => {
    const markup = renderToStaticMarkup(<LevelMeter levels={[0.25]} label="x" />);
    expect(markup).toContain('motion-reduce:hidden');
    expect(markup).toContain('motion-reduce:flex');
    expect(markup.match(/data-simple-bar/g)).toHaveLength(1);
  });

  it('clamps bad values', () => {
    expect(barHeight(-1)).toBe(LEVEL_METER_MIN);
    expect(barHeight(5)).toBe(1);
    expect(barHeight(Number.NaN)).toBe(LEVEL_METER_MIN);
  });
});
